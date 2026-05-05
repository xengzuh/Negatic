// Thin typed client for Meta's WhatsApp Cloud API outbound messages.
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

export interface WhatsAppClient {
  sendText(opts: { to: string; body: string }): Promise<void>;
  sendButtons(opts: {
    to: string;
    bodyText: string;
    buttons: ReadonlyArray<{ id: string; title: string }>;
  }): Promise<void>;
}

export interface CreateWhatsAppClientOpts {
  phoneNumberId: string;
  accessToken: string;
  /** Defaults to v22.0. Bump when Meta deprecates. */
  apiVersion?: string;
  /** Override for tests. */
  fetch?: typeof globalThis.fetch;
}

export function createWhatsAppClient(
  opts: CreateWhatsAppClientOpts,
): WhatsAppClient {
  const apiVersion = opts.apiVersion ?? 'v22.0';
  const url = `https://graph.facebook.com/${apiVersion}/${opts.phoneNumberId}/messages`;
  const fetchFn = opts.fetch ?? globalThis.fetch;

  async function post(body: unknown): Promise<void> {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`WhatsApp API ${res.status}: ${text}`);
    }
  }

  return {
    async sendText({ to, body }) {
      await post({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      });
    },

    async sendButtons({ to, bodyText, buttons }) {
      // WhatsApp constraints. Surfaces as a thrown error so callers don't
      // discover at runtime via a 400 from Meta.
      if (buttons.length === 0 || buttons.length > 3) {
        throw new Error('WhatsApp allows 1-3 reply buttons');
      }
      for (const b of buttons) {
        if (b.title.length === 0 || b.title.length > 20) {
          throw new Error(`Button title must be 1-20 chars: "${b.title}"`);
        }
      }
      await post({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      });
    },
  };
}
