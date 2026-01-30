import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { uspsController } from '../controllers/UspsController.js';

async function uspsRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions): Promise<void> {
  fastify.get('/status', uspsController.getAuthStatus.bind(uspsController));
  fastify.get('/track/:trackingNumber', uspsController.trackShipment.bind(uspsController));
  fastify.get('/track/:trackingNumber/raw', uspsController.trackShipmentRaw.bind(uspsController));
}

export default uspsRoutes;