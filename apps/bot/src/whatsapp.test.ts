import { describe, expect, it, vi } from 'vitest';
import { createWhatsAppClient } from './whatsapp.js';

function makeFakeFetch(response: Partial<Response> = { ok: true }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      text: async () => '',
    } as Response;
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

describe('createWhatsAppClient.sendText', () => {
  it('POSTs the right URL with bearer auth and text payload', async () => {
    const { fetch, calls } = makeFakeFetch();
    const client = createWhatsAppClient({
      phoneNumberId: '111',
      accessToken: 'token',
      fetch,
    });

    await client.sendText({ to: '60123456789', body: 'hello' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://graph.facebook.com/v22.0/111/messages');

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token');
    expect(headers['Content-Type']).toBe('application/json');

    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '60123456789',
      type: 'text',
      text: { body: 'hello' },
    });
  });

  it('throws when Meta returns non-2xx', async () => {
    const { fetch } = makeFakeFetch({ ok: false, status: 401 });
    const client = createWhatsAppClient({
      phoneNumberId: '111',
      accessToken: 'expired',
      fetch,
    });
    await expect(
      client.sendText({ to: '60123456789', body: 'hi' }),
    ).rejects.toThrow(/WhatsApp API 401/);
  });

  it('uses the configured apiVersion', async () => {
    const { fetch, calls } = makeFakeFetch();
    const client = createWhatsAppClient({
      phoneNumberId: '111',
      accessToken: 'token',
      apiVersion: 'v23.0',
      fetch,
    });
    await client.sendText({ to: '6012', body: 'hi' });
    expect(calls[0]!.url).toBe('https://graph.facebook.com/v23.0/111/messages');
  });
});

describe('createWhatsAppClient.sendButtons', () => {
  it('emits the interactive button payload Meta expects', async () => {
    const { fetch, calls } = makeFakeFetch();
    const client = createWhatsAppClient({
      phoneNumberId: '111',
      accessToken: 'token',
      fetch,
    });

    await client.sendButtons({
      to: '60123456789',
      bodyText: 'Pick one',
      buttons: [
        { id: 'A', title: 'Order chicken' },
        { id: 'B', title: 'View catalog' },
      ],
    });

    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '60123456789',
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Pick one' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'A', title: 'Order chicken' } },
            { type: 'reply', reply: { id: 'B', title: 'View catalog' } },
          ],
        },
      },
    });
  });

  it('rejects more than 3 buttons (WhatsApp limit)', async () => {
    const { fetch } = makeFakeFetch();
    const client = createWhatsAppClient({
      phoneNumberId: '111',
      accessToken: 'token',
      fetch,
    });
    await expect(
      client.sendButtons({
        to: '60',
        bodyText: 'x',
        buttons: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' },
          { id: 'c', title: 'C' },
          { id: 'd', title: 'D' },
        ],
      }),
    ).rejects.toThrow(/1-3 reply buttons/);
  });

  it('rejects button titles longer than 20 chars', async () => {
    const { fetch } = makeFakeFetch();
    const client = createWhatsAppClient({
      phoneNumberId: '111',
      accessToken: 'token',
      fetch,
    });
    await expect(
      client.sendButtons({
        to: '60',
        bodyText: 'x',
        buttons: [{ id: 'a', title: 'this title is too long for whatsapp' }],
      }),
    ).rejects.toThrow(/1-20 chars/);
  });
});
