-- Create sop-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sop-images', 'sop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
CREATE POLICY "sop_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'sop-images');

-- Allow anyone to upload (anon can upload via PIN auth in app)
CREATE POLICY "sop_images_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'sop-images');

-- Allow anyone to update
CREATE POLICY "sop_images_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'sop-images');

-- Allow anyone to delete
CREATE POLICY "sop_images_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'sop-images');
