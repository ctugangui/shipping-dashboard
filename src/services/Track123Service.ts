import type { UnifiedShipment } from '../types/UnifiedShipment.js';

// ─── Track123 API Response Types ──────────────────────────────────────────────

interface Track123TrackingDetail {
  address?: string;
  [key: string]: unknown;
}

interface Track123Content {
  trackNo?: string;
  transitStatus?: string;
  localLogisticsInfo?: {
    trackingDetails?: Track123TrackingDetail[];
  };
  [key: string]: unknown;
}

interface Track123RejectedError {
  code?: string;
  message?: string;
  [key: string]: unknown;
}

interface Track123RejectedItem {
  trackNo?: string;
  error?: Track123RejectedError;
  [key: string]: unknown;
}

interface Track123Response {
  data?: {
    accepted?: {
      content?: Track123Content[];
    };
    rejected?: Track123RejectedItem[];
  };
  [key: string]: unknown;
}

// ─── Status Mapping ───────────────────────────────────────────────────────────

type UnifiedStatus = UnifiedShipment['status'];

/**
 * Map Track123 transitStatus strings to our UnifiedShipmentStatus.
 * DELIVERED          → DELIVERED
 * IN_TRANSIT         → IN_TRANSIT
 * PICK_UP            → IN_TRANSIT
 * OUT_FOR_DELIVERY   → IN_TRANSIT
 * *                  → PROCESSING
 */
function mapTrack123Status(transitStatus: string | undefined): UnifiedStatus {
  switch (transitStatus?.toUpperCase()) {
    case 'DELIVERED':
      return 'DELIVERED';
    case 'IN_TRANSIT':
    case 'PICK_UP':
    case 'OUT_FOR_DELIVERY':
      return 'IN_TRANSIT';
    default:
      return 'PROCESSING';
  }
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class Track123Error extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'Track123Error';
    this.statusCode = statusCode;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class Track123Service {
  private readonly queryUrl =
    'https://api.track123.com/gateway/open-api/tk/v2.1/track/query';

  private readonly importUrl =
    'https://api.track123.com/gateway/open-api/tk/v2.1/track/import';

  /**
   * Track a shipment via the Track123 aggregator API.
   * Used as a fallback provider for enterprise-gated carriers (e.g. OnTrac / LaserShip).
   *
   * Flow:
   *  1. POST /track/query
   *  2. If the response contains a rejected entry with error.code "A0400"
   *     (trackNo not registered), automatically register the number via
   *     POST /track/import, wait 2 000 ms for Track123 to fetch data from the
   *     carrier, then retry /track/query once more.
   *  3. If the retry still returns no content (Track123 is still fetching from
   *     OnTrac in the background), return a safe PROCESSING fallback so the
   *     package appears on the Kanban board immediately.
   */
  async getShipment(trackingNumber: string): Promise<UnifiedShipment> {
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new Track123Error('Tracking number is required', 400);
    }

    const apiSecret = process.env.TRACK123_API_SECRET;
    if (!apiSecret) {
      throw new Track123Error(
        'TRACK123_API_SECRET environment variable is not set',
        500
      );
    }

    // ── Step 1: Initial query ────────────────────────────────────────────────
    console.log(`[Track123Service] Querying Track123 for ${trackingNumber}...`);
    let data = await this.postQuery(trackingNumber, apiSecret);

    // ── Step 2: Check for A0400 (trackNo not registered) ────────────────────
    if (data?.data?.rejected?.[0]?.error?.code === 'A0400') {
      console.log("[Track123Service] Registering unknown number " + trackingNumber);

      // ── Step 2a: Register the tracking number via /track/import ───────────
      await this.importTrackingNumber(trackingNumber, apiSecret);

      // ── Step 2b: Wait 2 000 ms for Track123 to fetch carrier data ─────────
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ── Step 2c: Retry query ───────────────────────────────────────────────
      console.log(
        `[Track123Service] Retrying query for ${trackingNumber} after registration...`
      );
      data = await this.postQuery(trackingNumber, apiSecret);
    }

    // ── Step 3: Extract content and normalize ────────────────────────────────
    const content = data?.data?.accepted?.content?.[0];

    if (!content) {
      // Track123 is still fetching data from OnTrac in the background.
      // Return a safe PROCESSING fallback so the package appears on the board
      // immediately and gets updated in a future sync.
      console.log(
        `[Track123Service] No content yet for ${trackingNumber} — returning PROCESSING fallback.`
      );
      return {
        trackingNumber,
        carrier: 'ONTRAC',
        status: 'PROCESSING',
        estimatedDelivery: null,
        currentLocation: 'Pending Track123 Update',
        events: [],
      };
    }

    return this.normalizeResponse(trackingNumber, content);
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  /**
   * POST to /track/query and return the parsed JSON response.
   * Throws Track123Error on HTTP-level failures.
   */
  private async postQuery(
    trackingNumber: string,
    apiSecret: string
  ): Promise<Track123Response> {
    let response: Response;
    try {
      response = await fetch(this.queryUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'Track123-Api-Secret': apiSecret,
        },
        body: JSON.stringify({
          trackNoInfos: [{ trackNo: trackingNumber }],
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new Track123Error(`Track123 query request failed: ${message}`, 500);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Track123Service] Query API error [${response.status}]: ${errorText}`
      );
      throw new Track123Error(
        `Track123 API error [${response.status}]: ${response.statusText}`,
        response.status
      );
    }

    return (await response.json()) as Track123Response;
  }

  /**
   * POST to /track/import to register a new tracking number with Track123.
   * The body must be a raw JSON array: [{ trackNo }]
   * Throws Track123Error on HTTP-level failures.
   */
  private async importTrackingNumber(
    trackingNumber: string,
    apiSecret: string
  ): Promise<void> {
    let response: Response;
    try {
      response = await fetch(this.importUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'Track123-Api-Secret': apiSecret,
        },
        body: JSON.stringify([{ trackNo: trackingNumber }]),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new Track123Error(
        `Track123 import request failed: ${message}`,
        500
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Track123Service] Import API error [${response.status}]: ${errorText}`
      );
      throw new Track123Error(
        `Track123 import error [${response.status}]: ${response.statusText}`,
        response.status
      );
    }

    const result = await response.json();
    console.log(
      `[Track123Service] Import response for ${trackingNumber}:`,
      JSON.stringify(result)
    );
  }

  // ── Response Normalization ─────────────────────────────────────────────────

  private normalizeResponse(
    trackingNumber: string,
    content: Track123Content
  ): UnifiedShipment {
    // Map status — works for any carrier name (OnTrac, LaserShip, etc.)
    const status = mapTrack123Status(content.transitStatus);

    // Extract latest location from localLogisticsInfo
    const currentLocation: string =
      content.localLogisticsInfo?.trackingDetails?.[0]?.address ??
      'Unknown Location';

    console.log(
      `[Track123Service] ${trackingNumber} → status=${status}, location="${currentLocation}"`
    );

    return {
      trackingNumber,
      carrier: 'ONTRAC',
      status,
      estimatedDelivery: null,
      currentLocation: currentLocation || 'Unknown Location',
      events: [],
    };
  }
}

// Export singleton instance
export const track123Service = new Track123Service();

export default track123Service;
