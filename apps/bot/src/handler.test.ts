import { describe, expect, it, vi } from 'vitest';
import { handleIncoming } from './handler.js';
import type { WhatsAppClient } from './whatsapp.js';

function makeFakeWhatsApp() {
  const sendText = vi.fn(async (_opts: { to: string; body: string }) => {});
  const sendButtons = vi.fn(async () => {});
  const client: WhatsAppClient = { sendText, sendButtons };
  return { client, sendText, sendButtons };
}

// Faithful payload modeled on a real Meta webhook delivery, with phone
// numbers redacted.
const realisticTextPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '1234567890',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15555555555',
              phone_number_id: '999999999999',
            },
            contacts: [
              {
                profile: { name: 'TestUser' },
                wa_id: '60123456789',
              },
            ],
            messages: [
              {
                from: '60123456789',
                id: 'wamid.AAAA',
                timestamp: '1700000000',
                type: 'text',
                text: { body: 'Hi' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('handleIncoming', () => {
  it('replies to a text message with a personalised ack', async () => {
    const { client, sendText } = makeFakeWhatsApp();
    await handleIncoming(realisticTextPayload, client);

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith({
      to: '60123456789',
      body: expect.stringContaining('Hi TestUser'),
    });
  });

  it('falls back to "there" when contact name is missing', async () => {
    const { client, sendText } = makeFakeWhatsApp();
    const payload = {
      ...realisticTextPayload,
      entry: [
        {
          ...realisticTextPayload.entry[0],
          changes: [
            {
              ...realisticTextPayload.entry[0]!.changes[0],
              value: {
                ...realisticTextPayload.entry[0]!.changes[0]!.value,
                contacts: [],
              },
            },
          ],
        },
      ],
    };
    await handleIncoming(payload, client);
    expect(sendText).toHaveBeenCalledWith({
      to: '60123456789',
      body: expect.stringContaining('Hi there'),
    });
  });

  it('ignores changes whose field is not "messages"', async () => {
    const { client, sendText } = makeFakeWhatsApp();
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
                  metadata: {
                    display_phone_number: '1',
                    phone_number_id: '1',
                  },
                },
              },
            ],
          },
        ],
      },
      client,
    );
    expect(sendText).not.toHaveBeenCalled();
  });

  it('does nothing on a malformed payload (logs and returns)', async () => {
    const { client, sendText, sendButtons } = makeFakeWhatsApp();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleIncoming({ totally: 'wrong' }, client);
    expect(sendText).not.toHaveBeenCalled();
    expect(sendButtons).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn on a status/receipt-shaped payload (contacts without profile)', async () => {
    const { client, sendText } = makeFakeWhatsApp();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleIncoming(
      {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'x',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '1', phone_number_id: '1' },
                  // delivery receipts often have wa_id but no profile
                  contacts: [{ wa_id: '60' }],
                  // no `messages` array — just status / receipt
                },
              },
            ],
          },
        ],
      },
      client,
    );
    expect(warn).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores message types it does not handle yet (e.g. interactive)', async () => {
    const { client, sendText } = makeFakeWhatsApp();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'x',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '1',
                  phone_number_id: '1',
                },
                contacts: [{ profile: { name: 'X' }, wa_id: '60' }],
                messages: [
                  {
                    from: '60',
                    id: 'wamid.X',
                    timestamp: '0',
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: { id: 'A', title: 'A' },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    await handleIncoming(payload, client);
    expect(sendText).not.toHaveBeenCalled();
  });
});
