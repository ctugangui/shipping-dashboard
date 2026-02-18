import { prisma } from '../lib/prisma.js';
import { shipmentService } from '../services/ShipmentService.js';

// Shipments older than this many minutes will be eligible for refresh
const STALE_THRESHOLD_MINUTES = 30;

// Maximum shipments to refresh per cron run (rate-limit safety)
const MAX_PER_RUN = 5;

// Statuses that should NOT be refreshed (terminal states)
const SKIP_STATUSES = ['DELIVERED', 'UNKNOWN'];

/**
 * Core logic for the shipment refresh job.
 * Exported as a standalone function so it can be called manually
 * (e.g. via the /api/cron/trigger verification route).
 */
export async function runRefreshJob(): Promise<{ refreshed: number; errors: number }> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  // Find up to MAX_PER_RUN shipments that are:
  //   1. Not in a terminal status
  //   2. Not updated in the last STALE_THRESHOLD_MINUTES minutes
  const staleShipments = await prisma.cachedShipment.findMany({
    where: {
      status: {
        notIn: SKIP_STATUSES,
      },
      updatedAt: {
        lt: staleThreshold,
      },
    },
    orderBy: {
      updatedAt: 'asc', // oldest first
    },
    take: MAX_PER_RUN,
  });

  if (staleShipments.length === 0) {
    console.log('[Cron] No stale shipments to refresh.');
    return { refreshed: 0, errors: 0 };
  }

  console.log(`[Cron] Found ${staleShipments.length} stale shipment(s) to refresh.`);

  let refreshed = 0;
  let errors = 0;

  for (const shipment of staleShipments) {
    try {
      const updated = await shipmentService.refreshShipment(shipment.trackingNumber);
      console.log(
        `[Cron] Refreshed ${shipment.trackingNumber}: New Status: ${updated.status}`
      );
      refreshed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[Cron] Failed to refresh ${shipment.trackingNumber}: ${message}`
      );
      errors++;
      // Continue to next shipment — do not crash the server
    }
  }

  console.log(`[Cron] Run complete. Refreshed: ${refreshed}, Errors: ${errors}`);
  return { refreshed, errors };
}
