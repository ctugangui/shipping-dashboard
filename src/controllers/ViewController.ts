import type { FastifyRequest, FastifyReply } from 'fastify';
import { shipmentService } from '../services/ShipmentService.js';
import { googleSheetsService } from '../services/GoogleSheetsService.js';
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

    // Extract error, warning, and success messages from query string
    const query = req.query as Record<string, string | undefined>;
    const error = query.error ?? null;
    const warning = query.warning ?? null;
    const success = query.success ?? null;

    return reply.view('index.ejs', {
      title: 'Shipping Dashboard',
      processing,
      inTransit,
      delivered,
      lastSynced,
      error,
      warning,
      success,
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

      // Check for duplicate before hitting carrier APIs
      if (await shipmentService.shipmentExists(trackingNumber)) {
        return reply.redirect('/?warning=' + encodeURIComponent('Tracking number already exists in your dashboard.'));
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
   * Sync tracking numbers from Google Sheets.
   * Skips numbers already in the dashboard; fetches and caches new ones.
   */
  async syncSheets(req: FastifyRequest, reply: FastifyReply) {
    try {
      const trackingNumbers = await googleSheetsService.getTrackingNumbers();

      let newCount = 0;
      for (const number of trackingNumbers) {
        const exists = await shipmentService.shipmentExists(number);
        if (!exists) {
          try {
            await shipmentService.getShipment(number);
            newCount++;
          } catch {
            // Skip numbers that fail to resolve (unknown carrier, API error, etc.)
          }
        }
      }

      return reply.redirect(
        '/?success=' + encodeURIComponent(`Synced ${newCount} new package${newCount !== 1 ? 's' : ''} from Google Sheets.`)
      );
    } catch (err: any) {
      const encoded = encodeURIComponent(err.message || 'Failed to sync from Google Sheets.');
      return reply.redirect(`/?error=${encoded}`);
    }
  }

  /**
   * Refresh all active (non-delivered) shipments by re-querying their carrier APIs
   */
  async refreshActive(req: FastifyRequest, reply: FastifyReply) {
    try {
      const activeShipments = await shipmentService.getActiveShipments();

      for (const shipment of activeShipments) {
        try {
          await shipmentService.updateShipment(shipment.trackingNumber);
        } catch {
          // Skip shipments that fail to update (API error, unknown carrier, etc.)
        }
        await new Promise(r => setTimeout(r, 500));
      }

      return reply.redirect('/?success=' + encodeURIComponent('Refreshed all active shipments.'));
    } catch (err: any) {
      const encoded = encodeURIComponent(err.message || 'Failed to refresh active shipments.');
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
