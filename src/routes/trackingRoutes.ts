import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { shipmentService } from '../services/ShipmentService.js';
import { LocalCourierError } from '../services/LocalCourierService.js';
import { UpsTrackingError } from '../services/UpsTrackingService.js';
import { UspsTrackingError } from '../services/UspsTrackingService.js';

// Request params interface
interface TrackShipmentParams {
  trackingNumber: string;
}

// Request query interface
interface TrackShipmentQuery {
  refresh?: string;
}

/**
 * Unified tracking routes - handles all carriers through ShipmentService
 */
async function trackingRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  /**
   * GET /api/track/cache/stats
   * Get cache statistics across all carriers
   * NOTE: Must be registered BEFORE /:trackingNumber to avoid route conflicts
   */
  fastify.get('/cache/stats', async (request, reply) => {
    try {
      const stats = await shipmentService.getCacheStats();

      return reply.status(200).send({
        status: 'OK',
        data: stats,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get cache stats');
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return reply.status(500).send({
        status: 'ERROR',
        message: errorMessage,
      });
    }
  });

  /**
   * DELETE /api/track/cache/:trackingNumber
   * Invalidate cache for a specific tracking number
   */
  fastify.delete<{ Params: TrackShipmentParams }>(
    '/cache/:trackingNumber',
    async (request, reply) => {
      const { trackingNumber } = request.params;

      try {
        await shipmentService.invalidateCache(trackingNumber);

        return reply.status(200).send({
          status: 'OK',
          message: `Cache invalidated for ${trackingNumber}`,
        });
      } catch (error) {
        request.log.error(error, `Failed to invalidate cache: ${trackingNumber}`);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        return reply.status(500).send({
          status: 'ERROR',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/track/detect/:trackingNumber
   * Detect carrier for a tracking number without fetching data
   */
  fastify.get<{ Params: TrackShipmentParams }>(
    '/detect/:trackingNumber',
    async (request, reply) => {
      const { trackingNumber } = request.params;
      const carrier = shipmentService.detectCarrier(trackingNumber);

      if (!carrier) {
        return reply.status(400).send({
          status: 'ERROR',
          message: 'Unable to detect carrier for tracking number',
          trackingNumber,
          supportedFormats: {
            UPS: '1Z + 16 alphanumeric characters',
            USPS: '94/93/92/95 + 20-22 digits',
            LOCAL: 'LOC + any characters (for testing)',
          },
        });
      }

      return reply.status(200).send({
        status: 'OK',
        trackingNumber: trackingNumber.toUpperCase().replace(/\s/g, ''),
        carrier,
      });
    }
  );

  /**
   * GET /api/track/:trackingNumber
   * Universal tracking endpoint - auto-detects carrier
   * Query: ?refresh=true to force refresh from carrier API
   * NOTE: Must be registered LAST due to wildcard parameter
   */
  fastify.get<{ Params: TrackShipmentParams; Querystring: TrackShipmentQuery }>(
    '/:trackingNumber',
    async (request, reply) => {
      const { trackingNumber } = request.params;
      const forceRefresh = request.query.refresh === 'true';

      try {
        // Detect carrier for logging
        const detectedCarrier = shipmentService.detectCarrier(trackingNumber);

        const data = forceRefresh
          ? await shipmentService.refreshShipment(trackingNumber)
          : await shipmentService.getShipment(trackingNumber);

        return reply.status(200).send({
          status: 'OK',
          carrier: data.carrier,
          detectedCarrier,
          data,
        });
      } catch (error) {
        request.log.error(error, `Failed to track shipment: ${trackingNumber}`);

        // Handle specific carrier errors
        if (
          error instanceof UpsTrackingError ||
          error instanceof UspsTrackingError ||
          error instanceof LocalCourierError
        ) {
          const statusCode =
            error.statusCode >= 400 && error.statusCode < 600
              ? error.statusCode
              : 500;

          return reply.status(statusCode).send({
            status: 'ERROR',
            message: error.message,
            errorCode:
              (error as UpsTrackingError).upsErrorCode ||
              (error as UspsTrackingError).uspsErrorCode ||
              (error as LocalCourierError).errorCode,
          });
        }

        // Generic error handling
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        return reply.status(500).send({
          status: 'ERROR',
          message: errorMessage,
        });
      }
    }
  );
}

export default trackingRoutes;