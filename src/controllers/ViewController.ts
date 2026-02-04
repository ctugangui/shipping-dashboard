import type { FastifyRequest, FastifyReply } from 'fastify';
import { shipmentService } from '../services/ShipmentService.js';

export class ViewController {

  /**
   * Render the main dashboard page
   */
  async home(req: FastifyRequest, reply: FastifyReply) {
    return reply.view('index.ejs', {
      title: 'Shipping Dashboard',
    });
  }

  /**
   * Handle HTMX tracking request and return HTML fragment
   */
  async trackFragment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as { trackingNumber?: string };
      const trackingNumber = body.trackingNumber?.trim();

      if (!trackingNumber) {
        return reply
          .type('text/html')
          .send('<div style="color: red; padding: 1rem; border: 1px solid red; border-radius: 4px;">Error: Tracking number is required</div>');
      }

      // Call the shipment service to track the package
      const shipment = await shipmentService.getShipment(trackingNumber);

      // Return the shipment card partial
      return reply.view('partials/shipment-card.ejs', { shipment });
    } catch (error: any) {
      // Return error as HTML fragment (not JSON)
      const errorMessage = error.message || 'Unknown error occurred';
      return reply
        .type('text/html')
        .send(`<div style="color: red; padding: 1rem; border: 1px solid red; border-radius: 4px; background-color: #fee;">Error: ${errorMessage}</div>`);
    }
  }
}
