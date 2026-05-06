import type { Product } from './products.js';
import type {
  BotSessionState,
  OrderDraft,
  Session,
} from './sessions.js';

// ---------------------------------------------------------------------------
// Order-entry state machine. Pure functions only — no Supabase, no WhatsApp.
// The handler runs the side effects.
//
// MVP flow (3 active states; `choosing_date` reserved for later):
//   start → choosing_product → choosing_quantity → confirming → DONE
// ---------------------------------------------------------------------------

/** Normalised input the state machine reasons about. */
export type Input =
  | { kind: 'text'; body: string }
  | { kind: 'button_reply'; id: string; title: string }
  | { kind: 'list_reply'; id: string; title: string };

export type Reply =
  | { kind: 'text'; body: string }
  | {
      kind: 'list';
      bodyText: string;
      buttonText: string;
      sections: ReadonlyArray<{
        title: string;
        rows: ReadonlyArray<{ id: string; title: string; description?: string }>;
      }>;
    }
  | {
      kind: 'buttons';
      bodyText: string;
      buttons: ReadonlyArray<{ id: string; title: string }>;
    };

/**
 * What the state machine wants the handler to do next.
 *  - `continue`: persist new state+draft and send the reply
 *  - `commit`: write the order (using draft + restaurant), delete session,
 *    send the reply
 *  - `cancel`: delete the session, send the reply
 *  - `invalid`: don't persist anything; just resend the prompt
 */
export type Outcome =
  | {
      kind: 'continue';
      newState: BotSessionState;
      draft: OrderDraft;
      reply: Reply;
    }
  | { kind: 'commit'; draft: OrderDraft; reply: Reply }
  | { kind: 'cancel'; reply: Reply }
  | { kind: 'invalid'; reply: Reply };

// ---------------------------------------------------------------------------
// Reply builders
// ---------------------------------------------------------------------------

const PRODUCT_PREFIX = 'PROD:';
const CONFIRM_ID = 'CONFIRM_ORDER';
const CANCEL_ID = 'CANCEL_ORDER';

function formatMyr(cents: number): string {
  return `RM ${(cents / 100).toFixed(2)}`;
}

export function tomorrowIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function productList(restaurantName: string, products: ReadonlyArray<Product>): Reply {
  if (products.length === 0) {
    return {
      kind: 'text',
      body: `Hi ${restaurantName}! No products in stock right now. Please try again later.`,
    };
  }
  return {
    kind: 'list',
    bodyText: `Hi ${restaurantName}! What would you like to order?`,
    buttonText: 'View products',
    sections: [
      {
        title: 'Chicken',
        rows: products.slice(0, 10).map((p) => ({
          id: `${PRODUCT_PREFIX}${p.id}`,
          // WhatsApp row title max is 24 chars; SKU names are short enough.
          title: p.name.slice(0, 24),
          description: `${formatMyr(p.price_per_unit_cents)} / ${p.unit}`,
        })),
      },
    ],
  };
}

function quantityPrompt(product: Product): Reply {
  return {
    kind: 'text',
    body: `${product.name} — how many ${product.unit}? (Reply with a number, e.g. "5")`,
  };
}

function confirmPrompt(draft: OrderDraft): Reply {
  const qty = draft.quantity ?? 0;
  const price = draft.unit_price_cents ?? 0;
  const total = Math.round(qty * price);
  return {
    kind: 'buttons',
    bodyText:
      `Please confirm:\n` +
      `• ${draft.product_name} — ${qty} ${draft.unit}\n` +
      `• Delivery: ${draft.delivery_date} (morning)\n` +
      `• Total: ${formatMyr(total)}`,
    buttons: [
      { id: CONFIRM_ID, title: 'Confirm order' },
      { id: CANCEL_ID, title: 'Cancel' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Transition: no active session
// ---------------------------------------------------------------------------

export function start(
  restaurantName: string,
  products: ReadonlyArray<Product>,
): Outcome {
  return {
    kind: 'continue',
    newState: 'choosing_product',
    draft: {},
    reply: productList(restaurantName, products),
  };
}

// ---------------------------------------------------------------------------
// Transition: active session
// ---------------------------------------------------------------------------

export function step(
  session: Session,
  input: Input,
  ctx: {
    /** Resolves a product picked from the list. */
    productById: (id: string) => Product | undefined;
    /** All products, for re-prompting. */
    products: ReadonlyArray<Product>;
    /** Restaurant name, for re-prompting. */
    restaurantName: string;
    /** "Today" anchor — injectable for tests. */
    now?: Date;
  },
): Outcome {
  // Universal cancel — any state, any input that says "cancel".
  if (isCancelInput(input)) {
    return {
      kind: 'cancel',
      reply: { kind: 'text', body: 'Order cancelled. Send any message to start again.' },
    };
  }

  switch (session.state) {
    case 'choosing_product':
      return onChoosingProduct(input, ctx);
    case 'choosing_quantity':
      return onChoosingQuantity(input, session.draft, ctx);
    case 'confirming':
      return onConfirming(input, session.draft, ctx);
    case 'choosing_date':
      // Reserved state — not visited in MVP. Treat as confirming for safety.
      return onConfirming(input, session.draft, ctx);
  }
}

function isCancelInput(input: Input): boolean {
  if (input.kind === 'button_reply' && input.id === CANCEL_ID) return true;
  if (input.kind === 'text' && /^cancel$/i.test(input.body.trim())) return true;
  return false;
}

function onChoosingProduct(
  input: Input,
  ctx: {
    productById: (id: string) => Product | undefined;
    products: ReadonlyArray<Product>;
    restaurantName: string;
    now?: Date;
  },
): Outcome {
  if (input.kind !== 'list_reply' || !input.id.startsWith(PRODUCT_PREFIX)) {
    return {
      kind: 'invalid',
      reply: productList(ctx.restaurantName, ctx.products),
    };
  }
  const productId = input.id.slice(PRODUCT_PREFIX.length);
  const product = ctx.productById(productId);
  if (!product) {
    return {
      kind: 'invalid',
      reply: productList(ctx.restaurantName, ctx.products),
    };
  }
  const draft: OrderDraft = {
    product_id: product.id,
    product_name: product.name,
    unit: product.unit,
    unit_price_cents: product.price_per_unit_cents,
    supplier_id: product.supplier_id,
  };
  return {
    kind: 'continue',
    newState: 'choosing_quantity',
    draft,
    reply: quantityPrompt(product),
  };
}

function onChoosingQuantity(
  input: Input,
  draft: OrderDraft,
  ctx: { now?: Date },
): Outcome {
  if (input.kind !== 'text') {
    return {
      kind: 'invalid',
      reply: {
        kind: 'text',
        body: `Please reply with a number, e.g. "5".`,
      },
    };
  }
  const qty = parseQuantity(input.body);
  if (qty === null) {
    return {
      kind: 'invalid',
      reply: {
        kind: 'text',
        body: `Sorry, "${input.body.trim()}" isn't a valid quantity. Try a number like "5" or "2.5".`,
      },
    };
  }
  if (!draft.product_id || draft.unit_price_cents === undefined) {
    // Defensive: shouldn't happen unless prior state was corrupted.
    return {
      kind: 'invalid',
      reply: {
        kind: 'text',
        body: 'Something went wrong with your order. Send any message to start again.',
      },
    };
  }
  const newDraft: OrderDraft = {
    ...draft,
    quantity: qty,
    delivery_date: tomorrowIso(ctx.now),
  };
  return {
    kind: 'continue',
    newState: 'confirming',
    draft: newDraft,
    reply: confirmPrompt(newDraft),
  };
}

function onConfirming(
  input: Input,
  draft: OrderDraft,
  _ctx: unknown,
): Outcome {
  if (input.kind === 'button_reply' && input.id === CONFIRM_ID) {
    return {
      kind: 'commit',
      draft,
      reply: {
        kind: 'text',
        // The order ID is filled in by the handler after the write succeeds.
        body: '__PENDING__',
      },
    };
  }
  return {
    kind: 'invalid',
    reply: confirmPrompt(draft),
  };
}

/** Accepts "5", "5.5", "5kg", "5 kg". Returns null on garbage. */
export function parseQuantity(raw: string): number | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(?:kg|pcs|liter|l)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// Public ID strings so the handler can build success messages without
// importing internals.
export const ORDER_FLOW_IDS = {
  CONFIRM: CONFIRM_ID,
  CANCEL: CANCEL_ID,
  PRODUCT_PREFIX,
};
