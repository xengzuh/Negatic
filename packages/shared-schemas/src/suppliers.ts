import { z } from 'zod';

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  business_registration: z.string().nullable().optional(),
  phone: z.string().min(1),
  address: z.string().nullable().optional(),
  delivery_zones: z.array(z.string()).default([]),
  halal_cert_number: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable().optional(),
});

export type Supplier = z.infer<typeof SupplierSchema>;
