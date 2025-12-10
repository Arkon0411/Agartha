-- ============================================
-- FIX STORAGE RLS POLICIES FOR POD PHOTOS
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop existing policies if they exist (allows re-running this script)
DROP POLICY IF EXISTS "Riders can upload POD photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view POD photos" ON storage.objects;
DROP POLICY IF EXISTS "Riders can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Riders can delete own uploads" ON storage.objects;

-- Step 2: Create INSERT policy - Allow authenticated users to upload
CREATE POLICY "Riders can upload POD photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'delivery-photos' AND
  auth.role() = 'authenticated'
);

-- Step 3: Create SELECT policy - Allow anyone to view (for public bucket)
CREATE POLICY "Anyone can view POD photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-photos');

-- Step 4: Create UPDATE policy - Allow authenticated users to update
CREATE POLICY "Riders can update own uploads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'delivery-photos' AND
  auth.role() = 'authenticated'
);

-- Step 5: Create DELETE policy - Allow authenticated users to delete
CREATE POLICY "Riders can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'delivery-photos' AND
  auth.role() = 'authenticated'
);

-- Step 6: Verify policies were created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%POD%'
ORDER BY policyname;

