import type { FastifyRequest, FastifyReply } from 'fastify';
import { upsAuthService, UpsAuthError } from '../services/UpsAuthService.js';
import { upsTrackingService, UpsTrackingError } from '../services/UpsTrackingService.js';

// Response interfaces
interface AuthStatusResponse {
  status: 'OK' | 'ERROR';
  provider?: string;
  message: string;
  error?: string;
  code?: string;
}

interface TrackingResponse {
  status: 'OK' | 'ERROR';
  provider?: string;
  data?: unknown;
  message?: string;
  error?: string;
}

// Request params interface
interface TrackShipmentParams {
  trackingNumber: string;
}

class UpsController {
  /**
   * GET /api/ups/status
   * Check if UPS authentication is working
   */
  async getAuthStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<AuthStatusResponse> {
    try {
      await upsAuthService.getToken();

      return reply.status(200).send({
        status: 'OK',
        provider: 'UPS',
        message: 'Token is valid',
      });
    } catch (error) {
      // Log the error details
      if (error instanceof UpsAuthError) {
        request.log.error(
          { code: error.code, statusCode: error.statusCode },
          `UPS Auth Error: ${error.message}`
        );

        return reply.status(502).send({
          status: 'ERROR',
          message: 'UPS Connection Failed',
          error: error.message,
          code: error.code,
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        request.log.error(error, 'UPS Connection Error');

        return reply.status(502).send({
          status: 'ERROR',
          message: 'UPS Connection Failed',
          error: errorMessage,
        });
      }
    }
  }

  /**
   * GET /api/ups/track/:trackingNumber
   * Track a shipment by tracking number
   */
  async trackShipment(
    request: FastifyRequest<{ Params: TrackShipmentParams }>,
    reply: FastifyReply
  ): Promise<TrackingResponse> {
    const { trackingNumber } = request.params;

    try {
      const data = await upsTrackingService.trackShipment(trackingNumber);

      return reply.status(200).send({
        status: 'OK',
        provider: 'UPS',
        data,
      });
    } catch (error) {
      request.log.error(error, `Failed to track shipment: ${trackingNumber}`);

      if (error instanceof UpsTrackingError) {
        const statusCode = error.statusCode >= 400 && error.statusCode < 600 
          ? error.statusCode 
          : 500;

        return reply.status(statusCode).send({
          status: 'ERROR',
          message: error.message,
          error: error.upsErrorCode,
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return reply.status(500).send({
        status: 'ERROR',
        message: errorMessage,
      });
    }
  }
}

// Export singleton instance
export const upsController = new UpsController();

export default upsController;