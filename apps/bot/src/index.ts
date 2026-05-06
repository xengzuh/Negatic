import 'dotenv/config';
import { loadMetaWhatsAppEnv, loadSupabaseServerEnv } from '@negatic/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './lib/db-types.js';
import { createOrderWriter } from './orders.js';
import { createProductCatalog } from './products.js';
import { createRestaurantLookup } from './restaurants.js';
import { createServer } from './server.js';
import { createSessionStore } from './sessions.js';
import { createWhatsAppClient } from './whatsapp.js';

const metaEnv = loadMetaWhatsAppEnv();
const supabaseEnv = loadSupabaseServerEnv();
const port = Number(process.env.PORT ?? 3001);

const supabase = createClient<Database>(
  supabaseEnv.SUPABASE_URL,
  supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
);

const whatsapp = createWhatsAppClient({
  phoneNumberId: metaEnv.META_WHATSAPP_PHONE_NUMBER_ID,
  accessToken: metaEnv.META_WHATSAPP_ACCESS_TOKEN,
});

const app = createServer({
  appSecret: metaEnv.META_APP_SECRET,
  verifyToken: metaEnv.META_WEBHOOK_VERIFY_TOKEN,
  handler: {
    whatsapp,
    restaurants: createRestaurantLookup(supabase),
    sessions: createSessionStore(supabase),
    products: createProductCatalog(supabase),
    orders: createOrderWriter(supabase),
  },
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
