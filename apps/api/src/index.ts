import { buildApp } from './app.js';

const port = Number.parseInt(process.env.PBX_API_PORT ?? '8080', 10);
const host = process.env.PBX_API_HOST ?? '0.0.0.0';
const app = buildApp();

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down better-pbx-api');
  await app.close();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error, 'failed to start better-pbx-api');
  process.exit(1);
}
