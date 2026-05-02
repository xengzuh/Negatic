-- Dev seed: 1 supplier, 3 restaurants, chicken catalog. Matches MVP scope.
-- Run via `supabase db reset`.

insert into suppliers (id, name, phone, address, delivery_zones, halal_cert_number, payment_terms)
values
  ('11111111-1111-1111-1111-111111111111',
   'PJ Halal Poultry Sdn Bhd',
   '+60123456789',
   'Lot 42, Jalan SS2/24, Petaling Jaya, Selangor',
   array['PJ','Subang'],
   'JAKIM-MS-1500-2019',
   'NET 7');

insert into products (id, supplier_id, sku, name, name_ms, category, unit, halal_certified, description)
values
  ('22222222-2222-2222-2222-222222222201',
   '11111111-1111-1111-1111-111111111111',
   'CHK-WHOLE',
   'Whole Chicken',
   'Ayam Penuh',
   'chicken', 'kg', true, 'Fresh whole chicken, JAKIM halal certified.'),
  ('22222222-2222-2222-2222-222222222202',
   '11111111-1111-1111-1111-111111111111',
   'CHK-BREAST',
   'Chicken Breast',
   'Dada Ayam',
   'chicken', 'kg', true, 'Boneless skinless chicken breast.'),
  ('22222222-2222-2222-2222-222222222203',
   '11111111-1111-1111-1111-111111111111',
   'CHK-THIGH',
   'Chicken Thigh',
   'Paha Ayam',
   'chicken', 'kg', true, 'Bone-in chicken thigh.'),
  ('22222222-2222-2222-2222-222222222204',
   '11111111-1111-1111-1111-111111111111',
   'CHK-WINGS',
   'Chicken Wings',
   'Kepak Ayam',
   'chicken', 'kg', true, 'Whole chicken wings.');

insert into inventory (product_id, available_quantity, price_per_unit_cents, min_order_quantity)
values
  ('22222222-2222-2222-2222-222222222201', 500, 1850, 1),
  ('22222222-2222-2222-2222-222222222202', 200, 2890, 1),
  ('22222222-2222-2222-2222-222222222203', 300, 2200, 1),
  ('22222222-2222-2222-2222-222222222204', 150, 1990, 1);

insert into restaurants (id, name, phone, whatsapp_number, address, delivery_zone, default_payment_method)
values
  ('33333333-3333-3333-3333-333333333301',
   'Nasi Kandar Original PJ', '+60111111111', '+60111111111',
   'No 1, Jalan 14/20, Petaling Jaya', 'PJ', 'NET 7'),
  ('33333333-3333-3333-3333-333333333302',
   'Subang Chicken Rice', '+60122222222', '+60122222222',
   'Lot 12, SS15, Subang Jaya', 'Subang', 'NET 7'),
  ('33333333-3333-3333-3333-333333333303',
   'Warung Ayam Penyet', '+60133333333', '+60133333333',
   'Jalan 17/45, Petaling Jaya', 'PJ', 'NET 14');
