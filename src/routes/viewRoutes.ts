import type { FastifyInstance } from 'fastify';
import { ViewController } from '../controllers/ViewController.js';
import { requireAuth } from '../middleware/auth.js';

const viewController = new ViewController();

export default async function viewRoutes(app: FastifyInstance) {
  // Main dashboard page — protected
  app.get('/', {
    preHandler: requireAuth(false),
  }, viewController.home.bind(viewController));

  // Standard form POST: track a shipment and redirect back to the dashboard — protected
  app.post('/track', {
    preHandler: requireAuth(false),
  }, viewController.trackShipment.bind(viewController));

  // Delete a cached shipment by ID — protected (API route → returns 401)
  app.delete('/api/shipments/:id', {
    preHandler: requireAuth(true),
  }, viewController.deleteShipment.bind(viewController));
}
