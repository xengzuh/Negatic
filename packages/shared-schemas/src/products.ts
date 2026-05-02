import { z } from 'zod';

export const UnitSchema = z.enum(['kg', 'pcs', 'liter']);
export type Unit = z.infer<typeof UnitSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  name_ms: z.string().nullable().optional(),
  category: z.string().min(1),
  unit: UnitSchema,
  halal_certified: z.boolean(),
  description: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ProductCreateSchema = z.object({
  supplier_id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  name_ms: z.string().optional(),
  category: z.string().min(1),
  unit: UnitSchema,
  halal_certified: z.boolean().default(false),
  description: z.string().optional(),
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductCreate = z.infer<typeof ProductCreateSchema>;
