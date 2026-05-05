import { z } from 'zod';
import type { WhatsAppClient } from './whatsapp.js';

// ---------------------------------------------------------------------------
// Inbound webhook payload schema.
// We only model the subset we care about. Meta's events also include
// statuses (sent/delivered/read receipts), errors, etc. — those are silently
// ignored until we need them.
// ---------------------------------------------------------------------------

const TextMessage = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.literal('text'),
  text: z.object({ body: z.string() }),
});

const InteractiveReply = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.literal('interactive'),
  interactive: z.object({
    type: z.literal('button_reply'),
    button_reply: z.object({
      id: z.string(),
      title: z.string(),
    }),
  }),
});

const IncomingMessage = z.discriminatedUnion('type', [
  TextMessage,
  InteractiveReply,
]);

// `profile` is sometimes absent — e.g., on delivery/read-receipt events
// Meta delivers under the same `field: "messages"` channel but with a
// stripped-down contacts[] entry. Optional so we don't reject those.
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
      changes: z.array(
        z.object({
          field: z.string(),
          value: WebhookValue,
        }),
      ),
    }),
  ),
});

export type WebhookPayload = z.infer<typeof WebhookPayload>;

/**
 * Handle one webhook delivery. Replies to plain text messages with a
 * placeholder ack so we can prove the round-trip. The actual order flow
 * lands in a follow-up.
 */
export async function handleIncoming(
  rawPayload: unknown,
  whatsapp: WhatsAppClient,
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
      const contacts = change.value.contacts ?? [];

      for (const msg of messages) {
        const contact = contacts.find((c) => c.wa_id === msg.from);
        const name = contact?.profile?.name ?? 'there';

        if (msg.type === 'text') {
          await whatsapp.sendText({
            to: msg.from,
            body: `Hi ${name}! Negatic bot is online. The order flow is being built — try again soon.`,
          });
        }
        // interactive button replies will route to the order flow once it lands.
      }
    }
  }
}
