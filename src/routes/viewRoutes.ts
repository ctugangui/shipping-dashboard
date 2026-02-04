import type { FastifyInstance } from 'fastify';
import { ViewController } from '../controllers/ViewController.js';

const viewController = new ViewController();

export default async function viewRoutes(app: FastifyInstance) {
  // Main dashboard page
  app.get('/', viewController.home.bind(viewController));

  // HTMX endpoint for tracking fragment
  app.post('/partials/track', viewController.trackFragment.bind(viewController));
}
