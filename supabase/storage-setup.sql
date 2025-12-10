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

-- Allow authenticated users to upload POD photos
CREATE POLICY "Riders can upload POD photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'delivery-photos' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to read POD photos
CREATE POLICY "Anyone can view POD photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-photos');

-- Allow riders to update their own uploads
CREATE POLICY "Riders can update own uploads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'delivery-photos' AND
  auth.uid()::text = (storage.foldername(name))[2]
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
