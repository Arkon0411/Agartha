-- ============================================
-- AGARTHA CASHLESS COD DELIVERY APP
-- Seed Data for Testing
-- ============================================
-- Run this AFTER running schema.sql and creating auth users

-- NOTE: You must first create users in Supabase Auth Dashboard:
-- 1. Go to Authentication > Users > Add User
-- 2. Create these users with the passwords shown
-- 3. Then run this script to set their roles

-- ============================================
-- UPDATE USER ROLES (run after creating auth users)
-- ============================================
-- After creating users in Auth, update their roles here:

-- Set admin role (replace 'admin@agartha.ph' with your admin email)
UPDATE public.users 
SET role = 'admin', full_name = 'Admin User'
WHERE email = 'admin@agartha.ph';

-- Set rider role (replace 'rider@agartha.ph' with your rider email)
UPDATE public.users 
SET role = 'rider', full_name = 'Juan Rider', phone = '09171234567'
WHERE email = 'rider@agartha.ph';

-- ============================================
-- SAMPLE ORDERS FOR TESTING
-- ============================================
-- These orders will be visible to riders to accept

INSERT INTO public.orders (
  order_number, package_description, cod_amount, barcode, barcode_image_url,
  pickup_address, pickup_contact_name, pickup_contact_phone,
  delivery_address, delivery_contact_name, delivery_contact_phone,
  status
) VALUES 
(
  'ORD-TEST-001',
  'Electronics - Smartphone',
  2500.00,
  'PKG240001TESTAA',
  'https://barcodeapi.org/api/128/PKG240001TESTAA',
  '123 Makati Ave, Makati City',
  'Seller Shop A',
  '09171111111',
  '456 BGC Highstreet, Taguig',
  'Maria Santos',
  '09172222222',
  'pending'
),
(
  'ORD-TEST-002',
  'Fashion - Clothing Items',
  1850.00,
  'PKG240002TESTBB',
  'https://barcodeapi.org/api/128/PKG240002TESTBB',
  '789 Ortigas Center, Pasig',
  'Fashion Hub Store',
  '09173333333',
  '321 Eastwood City, Quezon City',
  'Juan Dela Cruz',
  '09174444444',
  'pending'
),
(
  'ORD-TEST-003',
  'Food - Packed Goods',
  750.00,
  'PKG240003TESTCC',
  'https://barcodeapi.org/api/128/PKG240003TESTCC',
  '555 Alabang Town Center, Muntinlupa',
  'Gourmet Deli',
  '09175555555',
  '888 BF Homes, Parañaque',
  'Ana Garcia',
  '09176666666',
  'pending'
),
(
  'ORD-TEST-004',
  'Documents - Legal Papers',
  500.00,
  'PKG240004TESTDD',
  'https://barcodeapi.org/api/128/PKG240004TESTDD',
  '100 Ayala Avenue, Makati',
  'Law Office Corp',
  '09177777777',
  '200 Greenhills, San Juan',
  'Carlos Reyes',
  '09178888888',
  'pending'
),
(
  'ORD-TEST-005',
  'Gadgets - Laptop Accessories',
  3200.00,
  'PKG240005TESTEE',
  'https://barcodeapi.org/api/128/PKG240005TESTEE',
  '300 SM North EDSA, Quezon City',
  'Tech Gadgets PH',
  '09179999999',
  '400 Commonwealth Ave, Quezon City',
  'Rosa Villarreal',
  '09170000000',
  'pending'
);

-- Verify the data
SELECT order_number, cod_amount, status, barcode FROM public.orders;

