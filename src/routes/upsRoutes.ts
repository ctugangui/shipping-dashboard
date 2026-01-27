import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { upsController } from '../controllers/UpsController.js';

async function upsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // GET /api/ups/status
  fastify.get('/status', upsController.getAuthStatus.bind(upsController));

  // GET /api/ups/track/:trackingNumber
  fastify.get('/track/:trackingNumber', upsController.trackShipment.bind(upsController));
}

export default upsRoutes;