import { describe, expect, it } from 'vitest';
import {
  ORDER_FLOW_IDS,
  parseQuantity,
  start,
  step,
  tomorrowIso,
} from './order-flow.js';
import type { Product } from './products.js';
import type { Session } from './sessions.js';

const products: Product[] = [
  {
    id: 'prod-1',
    sku: 'CHK-WHOLE',
    name: 'Whole Chicken',
    unit: 'kg',
    supplier_id: 'supp-1',
    price_per_unit_cents: 1850,
    available_quantity: 500,
  },
  {
    id: 'prod-2',
    sku: 'CHK-BREAST',
    name: 'Chicken Breast',
    unit: 'kg',
    supplier_id: 'supp-1',
    price_per_unit_cents: 2890,
    available_quantity: 200,
  },
];

const NOW = new Date('2026-05-05T12:00:00Z');
const RESTAURANT_NAME = 'Nasi Kandar Original PJ';

const ctx = {
  productById: (id: string) => products.find((p) => p.id === id),
  products,
  restaurantName: RESTAURANT_NAME,
  now: NOW,
};

function session(state: Session['state'], draft: Session['draft'] = {}): Session {
  return {
    wa_id: '60123456789',
    restaurant_id: 'rest-1',
    state,
    draft,
  };
}

describe('parseQuantity', () => {
  it.each([
    ['5', 5],
    ['5.5', 5.5],
    ['  10  ', 10],
    ['5kg', 5],
    ['5 kg', 5],
    ['2.5 KG', 2.5],
    ['1 liter', 1],
  ])('parses %s → %s', (raw, expected) => {
    expect(parseQuantity(raw)).toBe(expected);
  });

  it.each(['', 'abc', '0', '-5', '5x', '1,5', 'five'])(
    'rejects %s',
    (raw) => {
      expect(parseQuantity(raw)).toBeNull();
    },
  );
});

describe('tomorrowIso', () => {
  it('returns next-day ISO date', () => {
    expect(tomorrowIso(new Date('2026-05-05T23:00:00Z'))).toBe('2026-05-06');
  });
});

describe('start (no active session)', () => {
  it('returns continue→choosing_product with the product list', () => {
    const out = start(RESTAURANT_NAME, products);
    expect(out.kind).toBe('continue');
    if (out.kind !== 'continue') return;
    expect(out.newState).toBe('choosing_product');
    expect(out.draft).toEqual({});
    expect(out.reply.kind).toBe('list');
    if (out.reply.kind !== 'list') return;
    expect(out.reply.bodyText).toContain(RESTAURANT_NAME);
    expect(out.reply.sections[0]!.rows).toHaveLength(2);
    expect(out.reply.sections[0]!.rows[0]!.id).toBe(`${ORDER_FLOW_IDS.PRODUCT_PREFIX}prod-1`);
  });

  it('returns plain text when no products are available', () => {
    const out = start(RESTAURANT_NAME, []);
    expect(out.kind).toBe('continue');
    if (out.kind !== 'continue') return;
    expect(out.reply.kind).toBe('text');
  });
});

describe('step from choosing_product', () => {
  it('list reply for a real product → continue→choosing_quantity', () => {
    const out = step(
      session('choosing_product'),
      { kind: 'list_reply', id: `${ORDER_FLOW_IDS.PRODUCT_PREFIX}prod-1`, title: 'Whole Chicken' },
      ctx,
    );
    expect(out.kind).toBe('continue');
    if (out.kind !== 'continue') return;
    expect(out.newState).toBe('choosing_quantity');
    expect(out.draft).toEqual({
      product_id: 'prod-1',
      product_name: 'Whole Chicken',
      unit: 'kg',
      unit_price_cents: 1850,
      supplier_id: 'supp-1',
    });
  });

  it('text input → invalid (re-prompts list)', () => {
    const out = step(session('choosing_product'), { kind: 'text', body: 'hello' }, ctx);
    expect(out.kind).toBe('invalid');
  });

  it('list reply with unknown product id → invalid', () => {
    const out = step(
      session('choosing_product'),
      { kind: 'list_reply', id: `${ORDER_FLOW_IDS.PRODUCT_PREFIX}does-not-exist`, title: 'X' },
      ctx,
    );
    expect(out.kind).toBe('invalid');
  });
});

describe('step from choosing_quantity', () => {
  const draft = {
    product_id: 'prod-1',
    product_name: 'Whole Chicken',
    unit: 'kg' as const,
    unit_price_cents: 1850,
    supplier_id: 'supp-1',
  };

  it('valid number → continue→confirming with delivery_date set to tomorrow', () => {
    const out = step(session('choosing_quantity', draft), { kind: 'text', body: '5' }, ctx);
    expect(out.kind).toBe('continue');
    if (out.kind !== 'continue') return;
    expect(out.newState).toBe('confirming');
    expect(out.draft.quantity).toBe(5);
    expect(out.draft.delivery_date).toBe('2026-05-06');
    expect(out.reply.kind).toBe('buttons');
  });

  it('non-text (e.g. list reply) → invalid', () => {
    const out = step(
      session('choosing_quantity', draft),
      { kind: 'list_reply', id: 'X', title: 'X' },
      ctx,
    );
    expect(out.kind).toBe('invalid');
  });

  it('garbage text → invalid', () => {
    const out = step(
      session('choosing_quantity', draft),
      { kind: 'text', body: 'abc' },
      ctx,
    );
    expect(out.kind).toBe('invalid');
  });
});

describe('step from confirming', () => {
  const confirmingDraft = {
    product_id: 'prod-1',
    product_name: 'Whole Chicken',
    unit: 'kg' as const,
    unit_price_cents: 1850,
    supplier_id: 'supp-1',
    quantity: 5,
    delivery_date: '2026-05-06',
  };

  it('Confirm button → commit', () => {
    const out = step(
      session('confirming', confirmingDraft),
      { kind: 'button_reply', id: ORDER_FLOW_IDS.CONFIRM, title: 'Confirm' },
      ctx,
    );
    expect(out.kind).toBe('commit');
    if (out.kind !== 'commit') return;
    expect(out.draft).toEqual(confirmingDraft);
  });

  it('Cancel button → cancel', () => {
    const out = step(
      session('confirming', confirmingDraft),
      { kind: 'button_reply', id: ORDER_FLOW_IDS.CANCEL, title: 'Cancel' },
      ctx,
    );
    expect(out.kind).toBe('cancel');
  });

  it('any other input → invalid (re-show summary)', () => {
    const out = step(
      session('confirming', confirmingDraft),
      { kind: 'text', body: 'yes please' },
      ctx,
    );
    expect(out.kind).toBe('invalid');
  });
});

describe('universal cancel', () => {
  it('text "cancel" at any state → cancel', () => {
    for (const s of ['choosing_product', 'choosing_quantity', 'confirming'] as const) {
      const out = step(session(s, {}), { kind: 'text', body: 'cancel' }, ctx);
      expect(out.kind).toBe('cancel');
    }
  });

  it('text "CANCEL" (any case) → cancel', () => {
    const out = step(session('confirming'), { kind: 'text', body: 'CANCEL' }, ctx);
    expect(out.kind).toBe('cancel');
  });
});
