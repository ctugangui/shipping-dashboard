import { config } from '../config/index.js';
import type { UnifiedShipment } from '../types/UnifiedShipment.js';

// ─── FedEx API Response Types ────────────────────────────────────────────────

interface FedexTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FedexTrackingEvent {
  timestamp?: string;
  eventType?: string;
  eventDescription?: string;
  address?: {
    city?: string;
    stateOrProvinceCode?: string;
    countryCode?: string;
  };
}

/**
 * Represents a single trackResult object inside completeTrackResults[0].trackResults[0].
 * This matches the actual FedEx production/sandbox JSON structure.
 */
interface FedexTrackResult {
  trackingNumberInfo?: {
    trackingNumber?: string;
  };
  latestStatusDetail?: {
    code?: string;
    description?: string;
    derivedCode?: string;
    scanLocation?: {
      city?: string;
      stateOrProvinceCode?: string;
      countryCode?: string;
    };
  };
  standardTransitTimeWindow?: {
    window?: {
      ends?: string;
    };
  };
  estimatedDeliveryTimeWindow?: {
    window?: {
      ends?: string;
    };
  };
  dateAndTimes?: Array<{
    type?: string;
    dateTime?: string;
  }>;
  scanEvents?: FedexTrackingEvent[];
}

interface FedexTrackingResponse {
  output?: {
    completeTrackResults?: Array<{
      trackResults?: FedexTrackResult[];
    }>;
  };
  errors?: Array<{ code?: string; message?: string }>;
}

// ─── Status Mapping ───────────────────────────────────────────────────────────

type UnifiedStatus = UnifiedShipment['status'];

/**
 * Map FedEx status codes to our UnifiedShipmentStatus.
 * Prefers derivedCode over code when available.
 * DL  → DELIVERED
 * IT  → IN_TRANSIT  (In Transit)
 * OD  → IN_TRANSIT  (Out for Delivery)
 * *   → PROCESSING
 */
function mapFedexStatus(code: string | undefined): UnifiedStatus {
  switch (code?.toUpperCase()) {
    case 'DL':
      return 'DELIVERED';
    case 'IT':
    case 'OD':
      return 'IN_TRANSIT';
    default:
      return 'PROCESSING';
  }
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class FedexTrackingError extends Error {
  public readonly statusCode: number;
  public readonly fedexErrorCode?: string;

  constructor(message: string, statusCode: number, fedexErrorCode?: string) {
    super(message);
    this.name = 'FedexTrackingError';
    this.statusCode = statusCode;
    this.fedexErrorCode = fedexErrorCode;
  }
}

// ─── Token Cache ──────────────────────────────────────────────────────────────

const TOKEN_CACHE_MINUTES = 50; // FedEx tokens last 60 min; cache for 50

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

// ─── Service ──────────────────────────────────────────────────────────────────

class FedexTrackingService {
  private tokenCache: CachedToken | null = null;

  // ── Environment URL Routing ────────────────────────────────────────────────

  /**
   * Returns the correct FedEx base URL based on the FEDEX_ENV environment variable.
   * Defaults to sandbox if FEDEX_ENV is not set or is not 'production'.
   */
  private getBaseUrl(): string {
    if (process.env.FEDEX_ENV === 'production') {
      return 'https://apis.fedex.com';
    }
    return 'https://apis-sandbox.fedex.com';
  }

  // ── OAuth2 Token Exchange ──────────────────────────────────────────────────

  /**
   * Fetch a FedEx OAuth2 bearer token.
   * Uses the environment-appropriate base URL (sandbox or production).
   * Token is cached in memory for TOKEN_CACHE_MINUTES minutes.
   */
  async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      console.log('[FedexTrackingService] Using cached OAuth token');
      return this.tokenCache.token;
    }

    const baseUrl = this.getBaseUrl();
    console.log(`[FedexTrackingService] Fetching new OAuth token from ${baseUrl}...`);

    const tokenUrl = `${baseUrl}/oauth/token`;
    return this.fetchToken(tokenUrl);
  }

  private async fetchToken(tokenUrl: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.fedex.apiKey,
      client_secret: config.fedex.secret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      // Critical: throw immediately — do NOT cache the token or proceed
      throw new FedexTrackingError(
        `FedEx auth error [${response.status}]: ${text}`,
        response.status
      );
    }

    const data = (await response.json()) as FedexTokenResponse;

    if (!data.access_token) {
      throw new FedexTrackingError('FedEx token response missing access_token', 500);
    }

    // Cache the token
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + TOKEN_CACHE_MINUTES * 60 * 1000,
    };

    console.log(`[FedexTrackingService] Token cached (expires in ${TOKEN_CACHE_MINUTES} min)`);
    return data.access_token;
  }

  // ── Tracking Request ───────────────────────────────────────────────────────

  /**
   * Track a FedEx shipment by tracking number.
   * Returns a normalized UnifiedShipment.
   */
  async trackShipment(trackingNumber: string): Promise<UnifiedShipment> {
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new FedexTrackingError('Tracking number is required', 400);
    }

    const token = await this.getToken();
    const trackingUrl = `${this.getBaseUrl()}/track/v1/trackingnumbers`;

    const payload = {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber,
          },
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch(trackingUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new FedexTrackingError(`FedEx tracking request failed: ${message}`, 500);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FedexTrackingService] Tracking API error [${response.status}]: ${errorText}`);

      let errorMessage = `FedEx API Error: ${response.statusText}`;
      let fedexErrorCode: string | undefined;

      try {
        const errorJson = JSON.parse(errorText) as FedexTrackingResponse;
        if (errorJson.errors?.[0]) {
          errorMessage = errorJson.errors[0].message ?? errorMessage;
          fedexErrorCode = errorJson.errors[0].code;
        }
      } catch {
        // Use default error message
      }

      throw new FedexTrackingError(errorMessage, response.status, fedexErrorCode);
    }

    const rawData = (await response.json()) as FedexTrackingResponse;

    // If FedEx returned a 200 but included an errors array, surface it immediately
    if (rawData.errors && rawData.errors.length > 0) {
      console.error('[FedexTrackingService] FedEx returned errors in 200 response:', JSON.stringify(rawData.errors));
      const firstError = rawData.errors[0];
      throw new FedexTrackingError(
        firstError.message ?? 'FedEx returned an error',
        422,
        firstError.code
      );
    }

    return this.normalizeResponse(trackingNumber, rawData);
  }

  // ── Response Normalization ─────────────────────────────────────────────────

  private normalizeResponse(
    trackingNumber: string,
    raw: FedexTrackingResponse
  ): UnifiedShipment {
    // Navigate the actual FedEx JSON structure:
    // output.completeTrackResults[0].trackResults[0]
    const trackResults = raw.output?.completeTrackResults?.[0]?.trackResults?.[0];

    if (!trackResults || !trackResults.trackingNumberInfo) {
      console.error(`[FedexTrackingService] No trackResults found for ${trackingNumber}.`);
      throw new FedexTrackingError('Tracking number not found in FedEx system.', 404);
    }

    // Status — prefer derivedCode (e.g. "DL"), fall back to code
    const statusCode =
      trackResults.latestStatusDetail?.derivedCode ??
      trackResults.latestStatusDetail?.code;
    const status = mapFedexStatus(statusCode);

    // Current location — from latestStatusDetail.scanLocation
    let currentLocation: string | null = null;
    const scanLoc = trackResults.latestStatusDetail?.scanLocation;
    if (scanLoc) {
      const parts = [scanLoc.city, scanLoc.stateOrProvinceCode].filter(Boolean);
      currentLocation = parts.length > 0 ? parts.join(', ') : null;
    }

    // Estimated delivery — prefer standardTransitTimeWindow, then estimatedDeliveryTimeWindow,
    // then fall back to dateAndTimes array
    let estimatedDelivery: string | null = null;
    const standardEnd = trackResults.standardTransitTimeWindow?.window?.ends;
    const estimatedEnd = trackResults.estimatedDeliveryTimeWindow?.window?.ends;

    if (standardEnd) {
      estimatedDelivery = new Date(standardEnd).toISOString();
    } else if (estimatedEnd) {
      estimatedDelivery = new Date(estimatedEnd).toISOString();
    } else {
      const deliveryDate = trackResults.dateAndTimes?.find(
        (d) => d.type === 'ESTIMATED_DELIVERY' || d.type === 'ACTUAL_DELIVERY'
      );
      if (deliveryDate?.dateTime) {
        estimatedDelivery = new Date(deliveryDate.dateTime).toISOString();
      }
    }

    // Events — from scanEvents array
    const events: UnifiedShipment['events'] = (trackResults.scanEvents ?? []).map((event) => {
      const { city, stateOrProvinceCode, countryCode } = event.address ?? {};
      const locationParts = [city, stateOrProvinceCode, countryCode].filter(Boolean);
      const location = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown Location';

      return {
        timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
        location,
        description: event.eventDescription ?? event.eventType ?? 'Status Update',
        status: mapFedexStatus(event.eventType),
      };
    });

    return {
      trackingNumber,
      carrier: 'FEDEX',
      status,
      estimatedDelivery,
      currentLocation,
      events,
    };
  }

}

// Export singleton instance
export const fedexTrackingService = new FedexTrackingService();

export default fedexTrackingService;
