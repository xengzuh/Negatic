import { z } from 'zod';

export const WebhookEventTypeSchema = z.enum([
  'order.created',
  'order.confirmed',
  'order.fulfilled',
  'order.cancelled',
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;

export const WebhookSchema = z.object({
  id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  url: z.string().url(),
  event_types: z.array(WebhookEventTypeSchema),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Webhook = z.infer<typeof WebhookSchema>;
