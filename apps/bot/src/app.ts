import { loadMetaWhatsAppEnv, loadSupabaseServerEnv } from '@negatic/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './lib/db-types.js';
import { createOrderWriter } from './orders.js';
import { createProductCatalog } from './products.js';
import { createRestaurantLookup } from './restaurants.js';
import { createServer } from './http.js';
import { createSessionStore } from './sessions.js';
import { createWhatsAppClient } from './whatsapp.js';

// Module-level wiring. Env vars must be present at import time (Vercel injects
// them before the function initialises; local dev uses dotenv in index.ts).
const metaEnv = loadMetaWhatsAppEnv();
const supabaseEnv = loadSupabaseServerEnv();

const supabase = createClient<Database>(
  supabaseEnv.SUPABASE_URL,
  supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
);

const whatsapp = createWhatsAppClient({
  phoneNumberId: metaEnv.META_WHATSAPP_PHONE_NUMBER_ID,
  accessToken: metaEnv.META_WHATSAPP_ACCESS_TOKEN,
});

export const app = createServer({
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
