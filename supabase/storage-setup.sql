-- ============================================
-- SUPABASE STORAGE SETUP FOR POD PHOTOS
-- Run this in Supabase SQL Editor to create the storage bucket
-- ============================================

-- Create the storage bucket for delivery photos (if it doesn't exist)
-- Note: This needs to be done via Supabase Dashboard > Storage or via the API
-- The SQL below sets up the RLS policies for the bucket

-- ============================================
-- STORAGE POLICIES
-- ============================================
-- Note: These policies need to be created AFTER the bucket is created
-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Riders can upload POD photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view POD photos" ON storage.objects;
DROP POLICY IF EXISTS "Riders can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Riders can delete own uploads" ON storage.objects;

-- Allow authenticated users (riders) to upload POD photos
-- This allows any authenticated user to upload to the delivery-photos bucket
CREATE POLICY "Riders can upload POD photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'delivery-photos' AND
  auth.role() = 'authenticated'
);

-- Allow anyone to read/view POD photos (public bucket)
CREATE POLICY "Anyone can view POD photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-photos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Riders can update own uploads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'delivery-photos' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their uploads
CREATE POLICY "Riders can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'delivery-photos' AND
  auth.role() = 'authenticated'
);

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name it: delivery-photos
-- 4. Make it PUBLIC (for easy access to POD images)
-- 5. Run this SQL to set up the policies
-- ============================================
