import type { FastifyRequest, FastifyReply } from 'fastify';
import { upsAuthService, UpsAuthError } from '../services/UpsAuthService.js';
import { shipmentService } from '../services/ShipmentService.js';
import { UpsTrackingError } from '../services/UpsTrackingService.js';

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
  cached?: boolean;
}

interface TrackShipmentParams {
  trackingNumber: string;
}

interface TrackShipmentQuery {
  refresh?: string;
}

class UpsController {
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
      if (error instanceof UpsAuthError) {
        request.log.error({ code: error.code, statusCode: error.statusCode }, `UPS Auth Error: ${error.message}`);
        return reply.status(502).send({
          status: 'ERROR',
          message: 'UPS Connection Failed',
          error: error.message,
          code: error.code,
        });
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      request.log.error(error, 'UPS Connection Error');
      return reply.status(502).send({
        status: 'ERROR',
        message: 'UPS Connection Failed',
        error: errorMessage,
      });
    }
  }

  /**
   * GET /api/ups/track/:trackingNumber?refresh=true
   */
  async trackShipment(
    request: FastifyRequest<{ Params: TrackShipmentParams; Querystring: TrackShipmentQuery }>,
    reply: FastifyReply
  ): Promise<TrackingResponse> {
    const { trackingNumber } = request.params;
    const forceRefresh = request.query.refresh === 'true';

    try {
      const data = forceRefresh
        ? await shipmentService.refreshShipment(trackingNumber)
        : await shipmentService.getShipment(trackingNumber);

      return reply.status(200).send({
        status: 'OK',
        provider: data.carrier,
        data,
      });
    } catch (error) {
      request.log.error(error, `Failed to track shipment: ${trackingNumber}`);

      if (error instanceof UpsTrackingError) {
        const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
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

  async getCacheStats(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    try {
      const stats = await shipmentService.getCacheStats();
      return reply.status(200).send({ status: 'OK', data: stats });
    } catch (error) {
      request.log.error(error, 'Failed to get cache stats');
      return reply.status(500).send({
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async invalidateCache(
    request: FastifyRequest<{ Params: TrackShipmentParams }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { trackingNumber } = request.params;
    try {
      await shipmentService.invalidateCache(trackingNumber);
      return reply.status(200).send({
        status: 'OK',
        message: `Cache invalidated for ${trackingNumber}`,
      });
    } catch (error) {
      request.log.error(error, `Failed to invalidate cache: ${trackingNumber}`);
      return reply.status(500).send({
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const upsController = new UpsController();
export default upsController;