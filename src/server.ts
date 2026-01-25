import { buildApp } from './app.js';
import { config } from './config/index.js';

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🚀 Server is running on http://${config.host}:${config.port}`);
    console.log(`📊 Health check: http://${config.host}:${config.port}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

start();
