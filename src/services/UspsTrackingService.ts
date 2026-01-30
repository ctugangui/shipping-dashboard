import { uspsAuthService } from './UspsAuthService.js';
import { config } from '../config/index.js';
import { normalizeUspsResponse } from '../utils/uspsMapper.js';
import type { UnifiedShipment } from '../types/UnifiedShipment.js';

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

class UspsTrackingService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.usps.baseUrl;
  }

  async trackShipment(trackingNumber: string, includeRaw = false): Promise<UnifiedShipment> {
    if (!trackingNumber?.trim()) {
      throw new UspsTrackingError('Tracking number is required', 400);
    }

    const token = await uspsAuthService.getToken();
    const cleanedTrackingNumber = trackingNumber.replace(/\s/g, '');
    const url = `${this.baseUrl}/tracking/v3/tracking/${encodeURIComponent(cleanedTrackingNumber)}?expand=DETAIL`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `USPS API Error: ${response.statusText}`;
        let uspsErrorCode: string | undefined;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.apiError?.error?.message || errorMessage;
          uspsErrorCode = errorJson.error?.code || errorJson.apiError?.error?.code;
        } catch {}

        throw new UspsTrackingError(errorMessage, response.status, uspsErrorCode);
      }

      const rawData = await response.json();
      if (rawData.error) {
        throw new UspsTrackingError(rawData.error.message || 'USPS tracking error', 400, rawData.error.code);
      }

      return normalizeUspsResponse(rawData, includeRaw);
    } catch (error) {
      if (error instanceof UspsTrackingError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new UspsTrackingError(`Failed to track shipment: ${message}`, 500);
    }
  }

  async trackShipmentRaw(trackingNumber: string): Promise<unknown> {
    if (!trackingNumber?.trim()) {
      throw new UspsTrackingError('Tracking number is required', 400);
    }

    const token = await uspsAuthService.getToken();
    const url = `${this.baseUrl}/tracking/v3/tracking/${encodeURIComponent(trackingNumber.replace(/\s/g, ''))}?expand=DETAIL`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new UspsTrackingError(`USPS API Error: ${response.statusText}`, response.status);
    }

    return response.json();
  }
}

export const uspsTrackingService = new UspsTrackingService();
export default uspsTrackingService;