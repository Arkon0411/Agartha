-- ============================================
-- FIX AMOUNT_PAID COLUMN TYPE
-- Run this in Supabase SQL Editor
-- This changes amount_paid from DECIMAL(10, 8) to DECIMAL(10, 2)
-- ============================================

-- Check current column definition
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name = 'amount_paid';

-- Alter the column to support larger amounts
-- DECIMAL(10, 2) allows values up to 99,999,999.99 (₱99.9M)
ALTER TABLE public.orders
  ALTER COLUMN amount_paid TYPE DECIMAL(10, 2) USING amount_paid::DECIMAL(10, 2);

-- Verify the change
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name = 'amount_paid';

-- If you also need to fix the rider_settlements table
ALTER TABLE public.rider_settlements
  ALTER COLUMN amount_paid TYPE DECIMAL(10, 2) USING amount_paid::DECIMAL(10, 2);

-- Verify rider_settlements change
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'rider_settlements'
  AND column_name = 'amount_paid';

