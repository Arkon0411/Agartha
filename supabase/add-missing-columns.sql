-- ============================================
-- ADD MISSING COLUMNS TO ORDERS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add last_webhook_event_id for webhook idempotency tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS last_webhook_event_id TEXT;

-- Add payment_error for tracking payment issues
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_error TEXT;

-- Add index for faster webhook idempotency checks (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_orders_last_webhook_event_id 
  ON public.orders(last_webhook_event_id) 
  WHERE last_webhook_event_id IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('last_webhook_event_id', 'payment_error')
ORDER BY column_name;

