import { config } from '../config/index.js';
import type { UnifiedShipment } from '../types/UnifiedShipment.js';

// ─── USPS API Response Types ──────────────────────────────────────────────────

interface UspsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  issued_at?: string;
}

interface UspsTrackingEventDetail {
  eventTime?: string;
  eventDate?: string;
  GMTTime?: string;
  GMTDate?: string;
  eventCity?: string;
  eventState?: string;
  eventZIPCode?: string;
  eventCountry?: string;
  eventType?: string;
  eventCode?: string;
}

interface UspsTrackSummary {
  eventTime?: string;
  eventDate?: string;
  eventCity?: string;
  eventState?: string;
  eventZIPCode?: string;
  eventCountry?: string;
  eventType?: string;
  eventCode?: string;
}

/**
 * Shape of a single element in the v3r2 POST response array.
 * USPS returns an array of results, one per tracking number submitted.
 */
interface UspsTrackingResult {
  TrackSummary?: UspsTrackSummary;
  TrackDetail?: UspsTrackingEventDetail[];
  Error?: {
    Number?: string;
    Description?: string;
  };
  // v3r2 top-level fields
  trackingNumber?: string;
  statusCategory?: string;
  statusSummary?: string;
  expectedDeliveryTimeStamp?: string;
  destinationCity?: string;
  destinationState?: string;
  trackingEvents?: Array<{
    eventTimestamp?: string;
    eventType?: string;
    eventCode?: string;
    eventCity?: string;
    eventState?: string;
    eventCountry?: string;
    eventZIPCode?: string;
  }>;
}

// ─── Status Mapping ───────────────────────────────────────────────────────────

type UnifiedStatus = UnifiedShipment['status'];

/**
 * Map USPS status text / event codes to our UnifiedShipmentStatus.
 *
 * USPS does not publish a stable numeric code set for v3r2, so we match
 * on human-readable status text (case-insensitive substring).
 *
 * "Delivered"              → DELIVERED
 * "Out for Delivery"       → IN_TRANSIT
 * "In Transit"             → IN_TRANSIT
 * "Departed"               → IN_TRANSIT
 * "Arrived"                → IN_TRANSIT
 * everything else          → PROCESSING
 */
function mapUspsStatus(statusText: string | undefined): UnifiedStatus {
  if (!statusText) return 'PROCESSING';

  const upper = statusText.toUpperCase();

  if (upper.includes('DELIVERED')) return 'DELIVERED';
  if (
    upper.includes('OUT FOR DELIVERY') ||
    upper.includes('IN TRANSIT') ||
    upper.includes('DEPARTED') ||
    upper.includes('ARRIVED') ||
    upper.includes('ENROUTE') ||
    upper.includes('EN ROUTE')
  ) {
    return 'IN_TRANSIT';
  }

  return 'PROCESSING';
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class UspsTrackingError extends Error {
  public readonly statusCode: number;
  public readonly uspsErrorCode?: string;

  constructor(message: string, statusCode: number, uspsErrorCode?: string) {
    super(message);
    this.name = 'UspsTrackingError';
    this.statusCode = statusCode;
    this.uspsErrorCode = uspsErrorCode;
  }
}

// ─── Token Cache ──────────────────────────────────────────────────────────────

const TOKEN_CACHE_MINUTES = 50; // USPS tokens last ~60 min; cache for 50

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

// ─── Service ──────────────────────────────────────────────────────────────────

class UspsTrackingService {
  private tokenCache: CachedToken | null = null;

  // ── Environment URL Routing ────────────────────────────────────────────────

  /**
   * Returns the correct USPS base URL based on the USPS_ENV environment variable.
   * Defaults to the sandbox (TEM) environment if USPS_ENV is not 'production'.
   */
  private getBaseUrl(): string {
    if (process.env.USPS_ENV === 'production') {
      return 'https://apis.usps.com';
    }
    return 'https://apis-tem.usps.com';
  }

  // ── OAuth2 Token Exchange ──────────────────────────────────────────────────

  /**
   * Fetch a USPS OAuth2 bearer token via client_credentials grant.
   * Token is cached in memory for TOKEN_CACHE_MINUTES minutes to avoid rate limits.
   */
  async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      console.log('[UspsTrackingService] Using cached OAuth token');
      return this.tokenCache.token;
    }

    const baseUrl = this.getBaseUrl();
    const tokenUrl = `${baseUrl}/oauth2/v3/token`;

    console.log(`[UspsTrackingService] Fetching new OAuth token from ${tokenUrl}...`);

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.usps.clientId,
      client_secret: config.usps.clientSecret,
    });

    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new UspsTrackingError(`USPS OAuth request failed: ${message}`, 500);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new UspsTrackingError(
        `USPS auth error [${response.status}]: ${text}`,
        response.status
      );
    }

    const data = (await response.json()) as UspsTokenResponse;

    if (!data.access_token) {
      throw new UspsTrackingError('USPS token response missing access_token', 500);
    }

    // Cache the token in memory
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + TOKEN_CACHE_MINUTES * 60 * 1000,
    };

    console.log(`[UspsTrackingService] Token cached (expires in ${TOKEN_CACHE_MINUTES} min)`);
    return data.access_token;
  }

  // ── Tracking Request ───────────────────────────────────────────────────────

  /**
   * Track a USPS shipment by tracking number using the v3r2 REST API.
   * Returns a normalized UnifiedShipment.
   */
  async trackShipment(trackingNumber: string): Promise<UnifiedShipment> {
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new UspsTrackingError('Tracking number is required', 400);
    }

    const cleanedTrackingNumber = trackingNumber.replace(/\s/g, '');
    const token = await this.getToken();
    const trackingUrl = `${this.getBaseUrl()}/tracking/v3r2/tracking`;

    console.log(`[UspsTrackingService] POST ${trackingUrl} for ${cleanedTrackingNumber}`);

    let response: Response;
    try {
      response = await fetch(trackingUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ trackingNumber: cleanedTrackingNumber }]),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new UspsTrackingError(`USPS tracking request failed: ${message}`, 500);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[UspsTrackingService] Tracking API error [${response.status}]: ${errorText}`
      );

      let errorMessage = `USPS API Error: ${response.statusText}`;
      let uspsErrorCode: string | undefined;

      try {
        const errorJson = JSON.parse(errorText) as {
          error?: { code?: string; message?: string };
          apiError?: { error?: { code?: string; message?: string } };
        };
        errorMessage =
          errorJson.error?.message ??
          errorJson.apiError?.error?.message ??
          errorMessage;
        uspsErrorCode =
          errorJson.error?.code ?? errorJson.apiError?.error?.code;
      } catch {
        // Use default error message
      }

      throw new UspsTrackingError(errorMessage, response.status, uspsErrorCode);
    }

    const rawData = (await response.json()) as UspsTrackingResult[];

    return this.normalizeResponse(cleanedTrackingNumber, rawData);
  }

  // ── Raw Tracking (debug endpoint) ─────────────────────────────────────────

  /**
   * Returns the raw USPS v3r2 API response array for debugging purposes.
   * Performs the same OAuth + POST flow as trackShipment but skips normalization.
   */
  async trackShipmentRaw(trackingNumber: string): Promise<unknown> {
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new UspsTrackingError('Tracking number is required', 400);
    }

    const cleanedTrackingNumber = trackingNumber.replace(/\s/g, '');
    const token = await this.getToken();
    const trackingUrl = `${this.getBaseUrl()}/tracking/v3r2/tracking`;

    let response: Response;
    try {
      response = await fetch(trackingUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ trackingNumber: cleanedTrackingNumber }]),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new UspsTrackingError(`USPS tracking request failed: ${message}`, 500);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new UspsTrackingError(
        `USPS API Error [${response.status}]: ${errorText}`,
        response.status
      );
    }

    return response.json() as Promise<unknown>;
  }

  // ── Response Normalization ─────────────────────────────────────────────────

  private normalizeResponse(
    trackingNumber: string,
    raw: UspsTrackingResult[]
  ): UnifiedShipment {
    // The API returns an array; grab the first result for our single tracking number
    const result = raw?.[0];

    if (!result) {
      throw new UspsTrackingError('No tracking data returned from USPS.', 404);
    }

    // Surface any USPS-level error embedded in the result
    if (result.Error?.Description) {
      const desc = result.Error.Description;
      const code = result.Error.Number;

      // "not found" style errors → 404
      if (desc.toLowerCase().includes('not found') || desc.toLowerCase().includes('invalid')) {
        throw new UspsTrackingError(desc, 404, code);
      }
      throw new UspsTrackingError(desc, 422, code);
    }

    // ── Status ────────────────────────────────────────────────────────────────
    // Prefer statusSummary (v3r2 top-level), fall back to TrackSummary.eventType
    const statusText =
      result.statusSummary ??
      result.statusCategory ??
      result.TrackSummary?.eventType;

    const status = mapUspsStatus(statusText);

    // ── Current Location ──────────────────────────────────────────────────────
    let currentLocation: string | null = null;

    const city = result.destinationCity ?? result.TrackSummary?.eventCity ?? null;
    const state = result.destinationState ?? result.TrackSummary?.eventState ?? null;

    if (city || state) {
      currentLocation = [city, state].filter(Boolean).join(', ');
    }

    // ── Estimated Delivery ────────────────────────────────────────────────────
    let estimatedDelivery: string | null = null;
    if (result.expectedDeliveryTimeStamp) {
      try {
        estimatedDelivery = new Date(result.expectedDeliveryTimeStamp).toISOString();
      } catch {
        estimatedDelivery = null;
      }
    }

    // ── Events ────────────────────────────────────────────────────────────────
    const events: UnifiedShipment['events'] = [];

    // v3r2 trackingEvents array (preferred)
    if (result.trackingEvents && result.trackingEvents.length > 0) {
      for (const ev of result.trackingEvents) {
        const locationParts = [ev.eventCity, ev.eventState, ev.eventCountry].filter(Boolean);
        events.push({
          timestamp: ev.eventTimestamp
            ? new Date(ev.eventTimestamp).toISOString()
            : new Date().toISOString(),
          location: locationParts.length > 0 ? locationParts.join(', ') : 'Unknown Location',
          description: ev.eventType ?? ev.eventCode ?? 'Status Update',
          status: mapUspsStatus(ev.eventType),
        });
      }
    } else {
      // Fall back to legacy TrackDetail array
      const details = result.TrackDetail ?? [];
      for (const ev of details) {
        const locationParts = [ev.eventCity, ev.eventState, ev.eventCountry].filter(Boolean);
        const timestamp =
          ev.eventDate && ev.eventTime
            ? new Date(`${ev.eventDate} ${ev.eventTime}`).toISOString()
            : new Date().toISOString();

        events.push({
          timestamp,
          location: locationParts.length > 0 ? locationParts.join(', ') : 'Unknown Location',
          description: ev.eventType ?? ev.eventCode ?? 'Status Update',
          status: mapUspsStatus(ev.eventType),
        });
      }

      // Prepend the summary event as the most-recent entry
      if (result.TrackSummary?.eventType) {
        const summaryLocationParts = [
          result.TrackSummary.eventCity,
          result.TrackSummary.eventState,
          result.TrackSummary.eventCountry,
        ].filter(Boolean);

        const summaryTimestamp =
          result.TrackSummary.eventDate && result.TrackSummary.eventTime
            ? new Date(
                `${result.TrackSummary.eventDate} ${result.TrackSummary.eventTime}`
              ).toISOString()
            : new Date().toISOString();

        events.unshift({
          timestamp: summaryTimestamp,
          location:
            summaryLocationParts.length > 0
              ? summaryLocationParts.join(', ')
              : 'Unknown Location',
          description: result.TrackSummary.eventType,
          status,
        });
      }
    }

    return {
      trackingNumber,
      carrier: 'USPS',
      status,
      estimatedDelivery,
      currentLocation,
      events,
    };
  }
}

// Export singleton instance
export const uspsTrackingService = new UspsTrackingService();

export default uspsTrackingService;
