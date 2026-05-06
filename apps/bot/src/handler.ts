import { z } from 'zod';
import {
  ORDER_FLOW_IDS,
  start,
  step,
  type Input,
  type Outcome,
  type Reply,
} from './order-flow.js';
import type { OrderWriter } from './orders.js';
import type { ProductCatalog } from './products.js';
import type { RestaurantLookup } from './restaurants.js';
import type { OrderDraft, SessionStore } from './sessions.js';
import type { WhatsAppClient } from './whatsapp.js';

// ---------------------------------------------------------------------------
// Inbound webhook payload schema (Meta WhatsApp Cloud API).
// ---------------------------------------------------------------------------

const TextMessage = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.literal('text'),
  text: z.object({ body: z.string() }),
});

const InteractiveMessage = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.literal('interactive'),
  interactive: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('button_reply'),
      button_reply: z.object({ id: z.string(), title: z.string() }),
    }),
    z.object({
      type: z.literal('list_reply'),
      list_reply: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
      }),
    }),
  ]),
});

const IncomingMessage = z.discriminatedUnion('type', [TextMessage, InteractiveMessage]);

const Contact = z.object({
  profile: z.object({ name: z.string() }).optional(),
  wa_id: z.string(),
});

const WebhookValue = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(Contact).optional(),
  messages: z.array(IncomingMessage).optional(),
});

export const WebhookPayload = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(z.object({ field: z.string(), value: WebhookValue })),
    }),
  ),
});

export type WebhookPayload = z.infer<typeof WebhookPayload>;
type IncomingMessage = z.infer<typeof IncomingMessage>;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface HandlerDeps {
  whatsapp: WhatsAppClient;
  restaurants: RestaurantLookup;
  sessions: SessionStore;
  products: ProductCatalog;
  orders: OrderWriter;
}

export async function handleIncoming(
  rawPayload: unknown,
  deps: HandlerDeps,
): Promise<void> {
  const parsed = WebhookPayload.safeParse(rawPayload);
  if (!parsed.success) {
    console.warn(
      '[handler] payload did not match expected schema:',
      parsed.error.message,
    );
    return;
  }

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      const messages = change.value.messages ?? [];
      for (const msg of messages) {
        await processMessage(msg, deps);
      }
    }
  }
}

async function processMessage(
  msg: IncomingMessage,
  deps: HandlerDeps,
): Promise<void> {
  const restaurant = await deps.restaurants.byWaId(msg.from);
  if (!restaurant) {
    await deps.whatsapp.sendText({
      to: msg.from,
      body: `This number isn't registered with Negatic. Please contact us to onboard your restaurant.`,
    });
    return;
  }

  const input = toInput(msg);
  if (!input) {
    // E.g. an interactive message we don't model. Ignore quietly.
    return;
  }

  const products = await deps.products.listAvailable();
  const session = await deps.sessions.get(msg.from);

  let outcome: Outcome;
  if (!session) {
    // Any first message from a known restaurant kicks off a fresh order.
    outcome = start(restaurant.name, products);
  } else {
    outcome = step(session, input, {
      productById: (id) => products.find((p) => p.id === id),
      products,
      restaurantName: restaurant.name,
    });
  }

  switch (outcome.kind) {
    case 'continue':
      await deps.sessions.upsert({
        wa_id: msg.from,
        restaurant_id: restaurant.id,
        state: outcome.newState,
        draft: outcome.draft,
      });
      await sendReply(deps.whatsapp, msg.from, outcome.reply);
      return;

    case 'commit':
      await commitOrder(msg.from, restaurant.id, outcome.draft, deps);
      return;

    case 'cancel':
      await deps.sessions.delete(msg.from);
      await sendReply(deps.whatsapp, msg.from, outcome.reply);
      return;

    case 'invalid':
      // Don't touch the session — just re-send the prompt.
      await sendReply(deps.whatsapp, msg.from, outcome.reply);
      return;
  }
}

async function commitOrder(
  to: string,
  restaurantId: string,
  draft: OrderDraft,
  deps: HandlerDeps,
): Promise<void> {
  if (
    !draft.product_id ||
    !draft.supplier_id ||
    draft.quantity === undefined ||
    draft.unit_price_cents === undefined ||
    !draft.delivery_date
  ) {
    await deps.whatsapp.sendText({
      to,
      body: 'Something went wrong with your order. Send any message to start again.',
    });
    await deps.sessions.delete(to);
    return;
  }

  try {
    const result = await deps.orders.create({
      restaurant_id: restaurantId,
      supplier_id: draft.supplier_id,
      delivery_date: draft.delivery_date,
      items: [
        {
          product_id: draft.product_id,
          quantity: draft.quantity,
          unit_price_cents: draft.unit_price_cents,
        },
      ],
    });
    await deps.sessions.delete(to);
    await deps.whatsapp.sendText({
      to,
      body:
        `Order placed.\n` +
        `Reference: ${result.id.slice(0, 8)}\n` +
        `Total: RM ${(result.total_amount_cents / 100).toFixed(2)}\n` +
        `Delivery: ${draft.delivery_date} (morning)`,
    });
  } catch (err) {
    console.error('[handler] order create failed:', err);
    await deps.whatsapp.sendText({
      to,
      body:
        'Sorry, we couldn’t save your order just now. Please try again in a minute. ' +
        'If the problem continues, contact Negatic support.',
    });
    // Keep the session so the user can retry confirm without re-doing the flow.
  }
}

function toInput(msg: IncomingMessage): Input | null {
  if (msg.type === 'text') {
    return { kind: 'text', body: msg.text.body };
  }
  if (msg.type === 'interactive') {
    if (msg.interactive.type === 'button_reply') {
      return {
        kind: 'button_reply',
        id: msg.interactive.button_reply.id,
        title: msg.interactive.button_reply.title,
      };
    }
    if (msg.interactive.type === 'list_reply') {
      return {
        kind: 'list_reply',
        id: msg.interactive.list_reply.id,
        title: msg.interactive.list_reply.title,
      };
    }
  }
  return null;
}

async function sendReply(
  wa: WhatsAppClient,
  to: string,
  reply: Reply,
): Promise<void> {
  switch (reply.kind) {
    case 'text':
      await wa.sendText({ to, body: reply.body });
      return;
    case 'list':
      await wa.sendList({
        to,
        bodyText: reply.bodyText,
        buttonText: reply.buttonText,
        sections: reply.sections,
      });
      return;
    case 'buttons':
      await wa.sendButtons({
        to,
        bodyText: reply.bodyText,
        buttons: reply.buttons,
      });
      return;
  }
}

// Re-export for callers that want it (e.g. tests).
export { ORDER_FLOW_IDS };
