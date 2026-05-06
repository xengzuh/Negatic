import { describe, expect, it, vi } from 'vitest';
import { handleIncoming, ORDER_FLOW_IDS } from './handler.js';
import type { OrderWriter } from './orders.js';
import type { Product, ProductCatalog } from './products.js';
import type { Restaurant, RestaurantLookup } from './restaurants.js';
import type { Session, SessionStore } from './sessions.js';
import type { WhatsAppClient } from './whatsapp.js';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function makeFakeWhatsApp() {
  const sendText = vi.fn(async (_o: { to: string; body: string }) => {});
  const sendButtons = vi.fn(async () => {});
  const sendList = vi.fn(async () => {});
  const client: WhatsAppClient = { sendText, sendButtons, sendList };
  return { client, sendText, sendButtons, sendList };
}

function makeFakeRestaurants(restaurant: Restaurant | null) {
  const byWaId = vi.fn(async () => restaurant);
  const lookup: RestaurantLookup = { byWaId };
  return { lookup, byWaId };
}

function makeFakeSessions(session: Session | null = null) {
  const get = vi.fn(async () => session);
  const upsert = vi.fn(async () => {});
  const del = vi.fn(async () => {});
  const store: SessionStore = { get, upsert, delete: del };
  return { store, get, upsert, delete: del };
}

function makeFakeProducts(products: ReadonlyArray<Product>) {
  const listAvailable = vi.fn(async () => [...products]);
  const getById = vi.fn(async (id: string) => products.find((p) => p.id === id) ?? null);
  const catalog: ProductCatalog = { listAvailable, getById };
  return { catalog, listAvailable, getById };
}

function makeFakeOrders(result = { id: 'order-uuid-1', total_amount_cents: 9250 }) {
  const create = vi.fn(async () => result);
  const writer: OrderWriter = { create };
  return { writer, create };
}

const restaurant: Restaurant = {
  id: 'rest-1',
  name: 'Nasi Kandar Original PJ',
  whatsapp_number: '+60123456789',
  delivery_zone: 'PJ',
};

const products: Product[] = [
  {
    id: 'prod-whole',
    sku: 'CHK-WHOLE',
    name: 'Whole Chicken',
    unit: 'kg',
    supplier_id: 'supp-1',
    price_per_unit_cents: 1850,
    available_quantity: 500,
  },
];

function textPayload(body: string, from = '60123456789') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15555555555', phone_number_id: '1' },
              contacts: [{ profile: { name: 'Jason' }, wa_id: from }],
              messages: [
                {
                  from,
                  id: 'wamid.AAAA',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function listReplyPayload(rowId: string, from = '60123456789') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15555555555', phone_number_id: '1' },
              contacts: [{ profile: { name: 'Jason' }, wa_id: from }],
              messages: [
                {
                  from,
                  id: 'wamid.LIST',
                  timestamp: '1700000000',
                  type: 'interactive',
                  interactive: {
                    type: 'list_reply',
                    list_reply: { id: rowId, title: 'X' },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buttonReplyPayload(buttonId: string, from = '60123456789') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15555555555', phone_number_id: '1' },
              contacts: [{ profile: { name: 'Jason' }, wa_id: from }],
              messages: [
                {
                  from,
                  id: 'wamid.BTN',
                  timestamp: '1700000000',
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: { id: buttonId, title: 'X' },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buildDeps(
  overrides: Partial<{
    restaurant: Restaurant | null;
    session: Session | null;
    products: Product[];
  }> = {},
) {
  const wa = makeFakeWhatsApp();
  const restaurants = makeFakeRestaurants(
    overrides.restaurant === undefined ? restaurant : overrides.restaurant,
  );
  const sessions = makeFakeSessions(overrides.session ?? null);
  const productsHelper = makeFakeProducts(overrides.products ?? products);
  const ordersHelper = makeFakeOrders();
  const handlerDeps = {
    whatsapp: wa.client,
    restaurants: restaurants.lookup,
    sessions: sessions.store,
    products: productsHelper.catalog,
    orders: ordersHelper.writer,
  };
  return {
    handlerDeps,
    wa,
    restaurants,
    sessions,
    products: productsHelper,
    orders: ordersHelper,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleIncoming — unknown sender', () => {
  it('sends a not-registered text and does not touch sessions', async () => {
    const { handlerDeps, wa, sessions } = buildDeps({ restaurant: null });
    await handleIncoming(textPayload('Hi'), handlerDeps);

    expect(wa.sendText).toHaveBeenCalledWith({
      to: '60123456789',
      body: expect.stringContaining("isn't registered"),
    });
    expect(sessions.get).not.toHaveBeenCalled();
    expect(sessions.upsert).not.toHaveBeenCalled();
  });
});

describe('handleIncoming — known sender, no active session', () => {
  it('starts a fresh order: sends product list and upserts choosing_product', async () => {
    const { handlerDeps, wa, sessions } = buildDeps();
    await handleIncoming(textPayload('Hi'), handlerDeps);

    expect(wa.sendList).toHaveBeenCalledTimes(1);
    expect(wa.sendList).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '60123456789',
        bodyText: expect.stringContaining('Nasi Kandar Original PJ'),
      }),
    );
    expect(sessions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        wa_id: '60123456789',
        restaurant_id: 'rest-1',
        state: 'choosing_product',
      }),
    );
  });
});

describe('handleIncoming — choosing_product state', () => {
  it('list reply for a known product advances to choosing_quantity', async () => {
    const session: Session = {
      wa_id: '60123456789',
      restaurant_id: 'rest-1',
      state: 'choosing_product',
      draft: {},
    };
    const { handlerDeps, wa, sessions } = buildDeps({ session });
    await handleIncoming(
      listReplyPayload(`${ORDER_FLOW_IDS.PRODUCT_PREFIX}prod-whole`),
      handlerDeps,
    );

    expect(sessions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'choosing_quantity',
        draft: expect.objectContaining({
          product_id: 'prod-whole',
          unit_price_cents: 1850,
          supplier_id: 'supp-1',
        }),
      }),
    );
    expect(wa.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Whole Chicken') }),
    );
  });
});

describe('handleIncoming — choosing_quantity state', () => {
  it('valid quantity advances to confirming with summary buttons', async () => {
    const session: Session = {
      wa_id: '60123456789',
      restaurant_id: 'rest-1',
      state: 'choosing_quantity',
      draft: {
        product_id: 'prod-whole',
        product_name: 'Whole Chicken',
        unit: 'kg',
        unit_price_cents: 1850,
        supplier_id: 'supp-1',
      },
    };
    const { handlerDeps, wa, sessions } = buildDeps({ session });
    await handleIncoming(textPayload('5'), handlerDeps);

    expect(sessions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'confirming',
        draft: expect.objectContaining({ quantity: 5 }),
      }),
    );
    expect(wa.sendButtons).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyText: expect.stringContaining('Whole Chicken'),
        buttons: expect.arrayContaining([
          expect.objectContaining({ id: ORDER_FLOW_IDS.CONFIRM }),
          expect.objectContaining({ id: ORDER_FLOW_IDS.CANCEL }),
        ]),
      }),
    );
  });

  it('invalid quantity re-prompts without changing state', async () => {
    const session: Session = {
      wa_id: '60123456789',
      restaurant_id: 'rest-1',
      state: 'choosing_quantity',
      draft: {
        product_id: 'prod-whole',
        product_name: 'Whole Chicken',
        unit: 'kg',
        unit_price_cents: 1850,
        supplier_id: 'supp-1',
      },
    };
    const { handlerDeps, wa, sessions } = buildDeps({ session });
    await handleIncoming(textPayload('a lot'), handlerDeps);

    expect(sessions.upsert).not.toHaveBeenCalled();
    expect(wa.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("isn't a valid") }),
    );
  });
});

describe('handleIncoming — confirming state', () => {
  const confirmingSession: Session = {
    wa_id: '60123456789',
    restaurant_id: 'rest-1',
    state: 'confirming',
    draft: {
      product_id: 'prod-whole',
      product_name: 'Whole Chicken',
      unit: 'kg',
      unit_price_cents: 1850,
      supplier_id: 'supp-1',
      quantity: 5,
      delivery_date: '2026-05-06',
    },
  };

  it('Confirm button writes the order, deletes the session, replies with reference', async () => {
    const { handlerDeps, wa, sessions, orders } = buildDeps({ session: confirmingSession });
    await handleIncoming(buttonReplyPayload(ORDER_FLOW_IDS.CONFIRM), handlerDeps);

    expect(orders.create).toHaveBeenCalledWith({
      restaurant_id: 'rest-1',
      supplier_id: 'supp-1',
      delivery_date: '2026-05-06',
      items: [{ product_id: 'prod-whole', quantity: 5, unit_price_cents: 1850 }],
    });
    expect(sessions.delete).toHaveBeenCalledWith('60123456789');
    expect(wa.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/Order placed.*Reference:/s),
      }),
    );
  });

  it('Cancel button deletes session and confirms cancellation', async () => {
    const { handlerDeps, wa, sessions, orders } = buildDeps({ session: confirmingSession });
    await handleIncoming(buttonReplyPayload(ORDER_FLOW_IDS.CANCEL), handlerDeps);

    expect(orders.create).not.toHaveBeenCalled();
    expect(sessions.delete).toHaveBeenCalledWith('60123456789');
    expect(wa.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('cancelled') }),
    );
  });

  it('keeps session intact when order create fails (so user can retry)', async () => {
    const wa = makeFakeWhatsApp();
    const restaurants = makeFakeRestaurants(restaurant);
    const sessions = makeFakeSessions(confirmingSession);
    const productsHelper = makeFakeProducts(products);
    const failingCreate = vi.fn(async () => {
      throw new Error('db down');
    });
    const orders: OrderWriter = { create: failingCreate };
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleIncoming(buttonReplyPayload(ORDER_FLOW_IDS.CONFIRM), {
      whatsapp: wa.client,
      restaurants: restaurants.lookup,
      sessions: sessions.store,
      products: productsHelper.catalog,
      orders,
    });

    expect(failingCreate).toHaveBeenCalled();
    expect(sessions.delete).not.toHaveBeenCalled();
    expect(wa.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("couldn’t save") }),
    );
    errSpy.mockRestore();
  });
});

describe('handleIncoming — payload edge cases', () => {
  it('does nothing on a malformed payload (logs and returns)', async () => {
    const { handlerDeps, wa, sessions } = buildDeps();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleIncoming({ totally: 'wrong' }, handlerDeps);
    expect(wa.sendText).not.toHaveBeenCalled();
    expect(sessions.get).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores non-messages fields like account_alerts', async () => {
    const { handlerDeps, wa, sessions } = buildDeps();
    await handleIncoming(
      {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'x',
            changes: [
              {
                field: 'account_alerts',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '1', phone_number_id: '1' },
                },
              },
            ],
          },
        ],
      },
      handlerDeps,
    );
    expect(wa.sendText).not.toHaveBeenCalled();
    expect(sessions.get).not.toHaveBeenCalled();
  });
});
