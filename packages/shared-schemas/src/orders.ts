import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'fulfilled',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price_cents: z.number().int().nonnegative(),
  line_total_cents: z.number().int().nonnegative(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderItemCreateSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
});
export type OrderItemCreate = z.infer<typeof OrderItemCreateSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  status: OrderStatusSchema,
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivery_window: z.string().nullable().optional(),
  total_amount_cents: z.number().int().nonnegative(),
  items: z.array(OrderItemSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderCreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivery_window: z.string().optional(),
  items: z.array(OrderItemCreateSchema).min(1),
});
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
