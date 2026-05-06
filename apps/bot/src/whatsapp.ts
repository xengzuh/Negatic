// Thin typed client for Meta's WhatsApp Cloud API outbound messages.
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

export interface ListRow {
  id: string;
  /** Max 24 chars per WhatsApp. */
  title: string;
  /** Max 72 chars. Optional — shown in smaller text under the title. */
  description?: string;
}

export interface ListSection {
  /** Max 24 chars. */
  title: string;
  rows: ReadonlyArray<ListRow>;
}

export interface WhatsAppClient {
  sendText(opts: { to: string; body: string }): Promise<void>;
  sendButtons(opts: {
    to: string;
    bodyText: string;
    buttons: ReadonlyArray<{ id: string; title: string }>;
  }): Promise<void>;
  /**
   * Interactive list message — like a dropdown picker. Use this when you
   * have more than 3 options (button max is 3); supports up to 10 rows
   * across all sections.
   */
  sendList(opts: {
    to: string;
    bodyText: string;
    /** Label on the "View options" button. Max 20 chars. */
    buttonText: string;
    sections: ReadonlyArray<ListSection>;
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

    async sendList({ to, bodyText, buttonText, sections }) {
      const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
      if (totalRows === 0 || totalRows > 10) {
        throw new Error('WhatsApp lists must have 1-10 rows total');
      }
      if (buttonText.length === 0 || buttonText.length > 20) {
        throw new Error(`List button text must be 1-20 chars: "${buttonText}"`);
      }
      for (const s of sections) {
        if (s.title.length > 24) {
          throw new Error(`Section title too long (max 24): "${s.title}"`);
        }
        for (const r of s.rows) {
          if (r.title.length === 0 || r.title.length > 24) {
            throw new Error(`Row title must be 1-24 chars: "${r.title}"`);
          }
          if (r.description && r.description.length > 72) {
            throw new Error(`Row description too long (max 72): "${r.description}"`);
          }
        }
      }
      await post({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections: sections.map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                id: r.id,
                title: r.title,
                ...(r.description !== undefined ? { description: r.description } : {}),
              })),
            })),
          },
        },
      });
    },
  };
}
