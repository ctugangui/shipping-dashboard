import type { FastifyRequest, FastifyReply } from 'fastify';
import { shipmentService } from '../services/ShipmentService.js';
import { googleSheetsService } from '../services/GoogleSheetsService.js';
import prisma from '../lib/prisma.js';

export class ViewController {

  /**
   * Render the main dashboard page with Kanban columns.
   * Supports optional ?q= search query to filter by tracking number.
   * Auto-archives DELIVERED shipments older than 7 days (they won't appear here).
   */
  async home(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as Record<string, string | undefined>;
    const searchQuery = query.q as string | undefined;

    const allShipments = await shipmentService.getRecentShipments(searchQuery);

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
      searchQuery: searchQuery ?? '',
    });
  }

  /**
   * Render the archive page with DELIVERED shipments older than 7 days.
   */
  async renderArchive(req: FastifyRequest, reply: FastifyReply) {
    const archivedShipments = await shipmentService.getArchivedShipments();

    return reply.view('archive.ejs', {
      title: 'Archive — Shipping Dashboard',
      archivedShipments,
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
   * Delegates to ShipmentService.runSheetSync() and redirects with result.
   */
  async syncSheets(req: FastifyRequest, reply: FastifyReply) {
    try {
      const newCount = await shipmentService.runSheetSync();
      return reply.redirect(
        '/?success=' + encodeURIComponent(`Synced ${newCount} new package${newCount !== 1 ? 's' : ''} from Google Sheets.`)
      );
    } catch (err: any) {
      const encoded = encodeURIComponent(err.message || 'Failed to sync from Google Sheets.');
      return reply.redirect(`/?error=${encoded}`);
    }
  }

  /**
   * Refresh all active (non-delivered) shipments by re-querying their carrier APIs.
   * Delegates to ShipmentService.runActiveRefresh() and redirects with result.
   */
  async refreshActive(req: FastifyRequest, reply: FastifyReply) {
    try {
      await shipmentService.runActiveRefresh();
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
