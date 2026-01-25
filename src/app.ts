import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyInstance } from './types/index.js';
import upsRoutes from './routes/upsRoutes.js';

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
  await app.register(upsRoutes, { prefix: '/api/ups' });

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
        upsStatus: '/api/ups/status',
      },
    };
  });

  return app;
}

export default buildApp;