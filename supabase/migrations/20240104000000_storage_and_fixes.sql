-- 1. Create Storage Bucket for Order Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-attachments', 'order-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Skip enabling RLS on objects as it requires superuser permissions and is enabled by default
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create Storage Policies (Public Access for MVP)
-- Allow public read
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'order-attachments' );

-- Allow authenticated uploads
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
CREATE POLICY "Authenticated Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'order-attachments' );

-- Allow authenticated updates/deletes
DROP POLICY IF EXISTS "Authenticated Updates" ON storage.objects;
CREATE POLICY "Authenticated Updates" ON storage.objects FOR UPDATE USING ( bucket_id = 'order-attachments' );

DROP POLICY IF EXISTS "Authenticated Deletes" ON storage.objects;
CREATE POLICY "Authenticated Deletes" ON storage.objects FOR DELETE USING ( bucket_id = 'order-attachments' );
