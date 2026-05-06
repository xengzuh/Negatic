import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT ?? 3001);

const server = app.listen(port, () => {
  console.log(`[bot] listening on http://127.0.0.1:${port}`);
});

const shutdown = (signal: string) => {
  console.log(`[bot] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
