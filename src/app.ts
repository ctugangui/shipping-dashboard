import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyInstance } from './types/index.js';
import upsRoutes from './routes/upsRoutes.js';
import uspsRoutes from './routes/uspsRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';

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

  // Register API routes
  await app.register(trackingRoutes, { prefix: '/api/track' }); // Unified tracking
  await app.register(upsRoutes, { prefix: '/api/ups' });        // UPS-specific
  await app.register(uspsRoutes, { prefix: '/api/usps' });      // USPS-specific

  // Health check route
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Root route
  app.get('/', async () => {
    return {
      name: 'Shipping Dashboard API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        tracking: {
          universal: '/api/track/:trackingNumber',
          detect: '/api/track/detect/:trackingNumber',
          cacheStats: '/api/track/cache/stats',
          invalidateCache: 'DELETE /api/track/cache/:trackingNumber',
        },
        ups: {
          status: '/api/ups/status',
          track: '/api/ups/track/:trackingNumber',
        },
        usps: {
          status: '/api/usps/status',
          track: '/api/usps/track/:trackingNumber',
        },
      },
      supportedCarriers: {
        UPS: '1Z + 16 alphanumeric characters',
        USPS: '94/93/92/95 + 20-22 digits',
        LOCAL: 'LOC + any characters (mock carrier for testing)',
      },
    };
  });

  return app;
}

export default buildApp;