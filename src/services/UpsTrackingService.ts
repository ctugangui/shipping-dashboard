import crypto from 'node:crypto';
import { upsAuthService } from './UpsAuthService.js';
import { config } from '../config/index.js';
import { normalizeUpsResponse } from '../utils/upsMapper.js';
import type { UnifiedShipment } from '../types/UnifiedShipment.js';

// UPS Raw API Response Type
interface UpsRawResponse {
  trackResponse?: {
    shipment?: unknown[];
  };
}

// Custom error class for UPS Tracking failures
export class UpsTrackingError extends Error {
  public readonly statusCode: number;
  public readonly upsErrorCode?: string;

  constructor(message: string, statusCode: number, upsErrorCode?: string) {
    super(message);
    this.name = 'UpsTrackingError';
    this.statusCode = statusCode;
    this.upsErrorCode = upsErrorCode;
  }
}

class UpsTrackingService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.ups.baseUrl;
  }

  /**
   * Track a shipment by tracking number
   * @param trackingNumber - UPS tracking number
   * @param includeRaw - Include raw UPS response in output (for debugging)
   * @returns Normalized UnifiedShipment data
   */
  async trackShipment(
    trackingNumber: string,
    includeRaw = false
  ): Promise<UnifiedShipment> {
    // Validate tracking number
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new UpsTrackingError('Tracking number is required', 400);
    }

    // Get valid token
    const token = await upsAuthService.getToken();

    // Generate transaction ID for UPS request tracing
    const transId = crypto.randomUUID();

    const url = `${this.baseUrl}/api/track/v1/details/${encodeURIComponent(trackingNumber)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          transId: transId,
          transactionSrc: 'testing',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `UPS Tracking API Error [${response.status}]: ${errorText}`
        );

        let errorMessage = `UPS API Error: ${response.statusText}`;
        let upsErrorCode: string | undefined;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.response?.errors?.[0]) {
            errorMessage = errorJson.response.errors[0].message || errorMessage;
            upsErrorCode = errorJson.response.errors[0].code;
          }
        } catch {
          // Use default error message if parsing fails
        }

        throw new UpsTrackingError(errorMessage, response.status, upsErrorCode);
      }

      const rawData = (await response.json()) as UpsRawResponse;

      // Normalize the response using the mapper
      const normalizedData = normalizeUpsResponse(rawData, includeRaw);

      return normalizedData;https://vclock.com/#time=11:30&title=Alarm&sound=bells&loop=1
    } catch (error) {
      if (error instanceof UpsTrackingError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new UpsTrackingError(
        `Failed to track shipment: ${message}`,
        500
      );
    }
  }

  /**
   * Track a shipment and return raw UPS response (for debugging)
   * @param trackingNumber - UPS tracking number
   * @returns Raw UPS API response
   */
  async trackShipmentRaw(trackingNumber: string): Promise<unknown> {
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new UpsTrackingError('Tracking number is required', 400);
    }

    const token = await upsAuthService.getToken();
    const transId = crypto.randomUUID();

    const url = `${this.baseUrl}/api/track/v1/details/${encodeURIComponent(trackingNumber)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        transId: transId,
        transactionSrc: 'testing',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new UpsTrackingError(
        `UPS API Error: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }
}

// Export singleton instance
export const upsTrackingService = new UpsTrackingService();

export default upsTrackingService;