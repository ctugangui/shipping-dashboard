import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { upsController } from '../controllers/UpsController.js';

async function upsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // GET /api/ups/status
  fastify.get('/status', upsController.getAuthStatus.bind(upsController));

  // GET /api/ups/track/:trackingNumber?refresh=true
  fastify.get('/track/:trackingNumber', upsController.trackShipment.bind(upsController));

  // GET /api/ups/cache/stats
  fastify.get('/cache/stats', upsController.getCacheStats.bind(upsController));

  // DELETE /api/ups/cache/:trackingNumber
  fastify.delete('/cache/:trackingNumber', upsController.invalidateCache.bind(upsController));
}

export default upsRoutes;