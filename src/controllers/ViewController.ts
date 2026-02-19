import type { FastifyRequest, FastifyReply } from 'fastify';
import { shipmentService } from '../services/ShipmentService.js';
import prisma from '../lib/prisma.js';

export class ViewController {

  /**
   * Render the main dashboard page with Kanban columns
   */
  async home(req: FastifyRequest, reply: FastifyReply) {
    const allShipments = await prisma.cachedShipment.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    const IN_TRANSIT_KEYWORDS = ['IN_TRANSIT', 'TRANSIT', 'OUT_FOR_DELIVERY', 'SHIPPED'];
    const DELIVERED_KEYWORDS   = ['DELIVERED'];

    const delivered = allShipments.filter(s =>
      DELIVERED_KEYWORDS.includes(s.status.toUpperCase())
    );

    const inTransit = allShipments.filter(s =>
      IN_TRANSIT_KEYWORDS.includes(s.status.toUpperCase())
    );

    const processing = allShipments.filter(s =>
      !DELIVERED_KEYWORDS.includes(s.status.toUpperCase()) &&
      !IN_TRANSIT_KEYWORDS.includes(s.status.toUpperCase())
    );

    const lastSynced = allShipments.length > 0
      ? allShipments.reduce((latest, s) =>
          s.updatedAt > latest ? s.updatedAt : latest,
          allShipments[0].updatedAt
        )
      : null;

    return reply.view('index.ejs', {
      title: 'Shipping Dashboard',
      processing,
      inTransit,
      delivered,
      lastSynced,
    });
  }

  /**
   * Handle standard form POST to track a shipment, then redirect to the dashboard
   */
  async trackShipment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as { trackingNumber?: string };
      const trackingNumber = body.trackingNumber?.trim();

      if (!trackingNumber) {
        return reply.redirect('/?error=missing_tracking_number');
      }

      // Fetch and cache the shipment
      await shipmentService.getShipment(trackingNumber);

      // Redirect back to the dashboard so the Kanban board refreshes with the new card
      return reply.redirect('/');
    } catch (error: any) {
      const encoded = encodeURIComponent(error.message || 'Unknown error');
      return reply.redirect(`/?error=${encoded}`);
    }
  }

  /**
   * Delete a cached shipment by ID
   */
  async deleteShipment(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    try {
      await prisma.cachedShipment.delete({ where: { id } });
      return reply.status(200).send({ success: true });
    } catch (error: any) {
      return reply.status(404).send({ success: false, error: 'Shipment not found' });
    }
  }
}
