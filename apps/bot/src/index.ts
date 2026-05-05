import 'dotenv/config';
import { loadMetaWhatsAppEnv } from '@negatic/config';
import { createServer } from './server.js';
import { createWhatsAppClient } from './whatsapp.js';

const env = loadMetaWhatsAppEnv();
const port = Number(process.env.PORT ?? 3001);

const whatsapp = createWhatsAppClient({
  phoneNumberId: env.META_WHATSAPP_PHONE_NUMBER_ID,
  accessToken: env.META_WHATSAPP_ACCESS_TOKEN,
});

const app = createServer({
  appSecret: env.META_APP_SECRET,
  verifyToken: env.META_WEBHOOK_VERIFY_TOKEN,
  whatsapp,
});

const server = app.listen(port, () => {
  console.log(`[bot] listening on http://127.0.0.1:${port}`);
});

const shutdown = (signal: string) => {
  console.log(`[bot] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
