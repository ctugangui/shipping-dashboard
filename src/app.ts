import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import fastifyFormBody from '@fastify/formbody';
import fastifyCron from 'fastify-cron';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FastifyInstance } from './types/index.js';
import upsRoutes from './routes/upsRoutes.js';
import uspsRoutes from './routes/uspsRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import viewRoutes from './routes/viewRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import { runRefreshJob } from './jobs/refresh-shipments.job.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register form body parser (for HTML form submissions)
  await app.register(fastifyFormBody);

  // Register view engine (EJS)
  await app.register(fastifyView, {
    engine: { ejs },
    root: path.join(__dirname, 'views'),
  });

  // Register static files (if needed in future)
  await app.register(fastifyStatic, {
    root: path.join(__dirname, 'public'),
    prefix: '/public/',
  });

  // Register view routes (HTML pages)
  await app.register(viewRoutes);

  // Register API routes
  await app.register(trackingRoutes, { prefix: '/api/track' }); // Unified tracking
  await app.register(upsRoutes, { prefix: '/api/ups' });        // UPS-specific
  await app.register(uspsRoutes, { prefix: '/api/usps' });      // USPS-specific
  await app.register(cronRoutes, { prefix: '/api/cron' });      // Cron management

  // Register fastify-cron plugin — schedules the background refresh job
  // Note: fastify-cron v1.x types target Fastify v4; the cast suppresses the
  // version mismatch while keeping full runtime functionality on Fastify v5.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyCron as any, {
    jobs: [
      {
        name: 'refresh-shipments',
        cronTime: '*/10 * * * *', // Every 10 minutes
        onTick: async () => {
          console.log('[Cron] Scheduled refresh-shipments job starting...');
          await runRefreshJob();
        },
        startWhenReady: true, // Start automatically once the server is ready
      },
    ],
  });

  // Health check route
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  return app;
}

export default buildApp;