import type { FastifyInstance } from 'fastify';
import { runRefreshJob } from '../jobs/refresh-shipments.job.js';

/**
 * Temporary verification route for manually triggering the cron job.
 * Useful for testing without waiting 10 minutes for the scheduler.
 *
 * GET /api/cron/trigger
 */
export default async function cronRoutes(app: FastifyInstance): Promise<void> {
  app.get('/trigger', async (_request, reply) => {
    console.log('[Cron] Manual trigger invoked via /api/cron/trigger');

    try {
      const result = await runRefreshJob();
      return reply.send({
        success: true,
        message: 'Cron job triggered successfully.',
        result,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Cron] Manual trigger failed: ${message}`);
      return reply.status(500).send({
        success: false,
        message: 'Cron job failed.',
        error: message,
      });
    }
  });
}
