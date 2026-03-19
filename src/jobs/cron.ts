import cron from 'node-cron';
import type { shipmentService as ShipmentServiceInstance } from '../services/ShipmentService.js';

/**
 * Start all background cron jobs.
 * Call this once after the server has successfully started.
 *
 * @param shipmentService - The singleton ShipmentService instance
 */
export function startCronJobs(shipmentService: typeof ShipmentServiceInstance): void {
  // Job 1: Sync new tracking numbers from Google Sheets every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Cron] Starting scheduled sheet sync...');
    const newCount = await shipmentService.runSheetSync();
    console.log(`[Cron] Sheet sync complete: ${newCount} new shipment(s) added.`);
  });

  // Job 2: Refresh all active shipments every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Starting scheduled active refresh...');
    const updatedCount = await shipmentService.runActiveRefresh();
    console.log(`[Cron] Active refresh complete: ${updatedCount} shipment(s) updated.`);
  });

  console.log('⏰ Cron jobs initialized: sheet sync (every 30 min), active refresh (every hour).');
}
