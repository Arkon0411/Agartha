-- ============================================
-- ADD INDEX FOR LAST_WEBHOOK_EVENT_ID
-- Run this in Supabase SQL Editor
-- ============================================

-- Add index for faster webhook idempotency checks
-- This is a partial index that only indexes non-null values
CREATE INDEX IF NOT EXISTS idx_orders_last_webhook_event_id 
  ON public.orders(last_webhook_event_id) 
  WHERE last_webhook_event_id IS NOT NULL;

-- Verify index was created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'orders' 
  AND indexname = 'idx_orders_last_webhook_event_id';

