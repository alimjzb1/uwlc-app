-- Add granular permissions to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "inventory": ["read"],
  "orders": ["read"],
  "customers": ["read"],
  "delivery": ["read"],
  "locations": ["read"]
}'::jsonB;

-- Set full permissions for admin
UPDATE public.profiles 
SET permissions = '{
  "inventory": ["all"],
  "orders": ["all"],
  "customers": ["all"],
  "delivery": ["all"],
  "locations": ["all"],
  "settings": ["all"]
}'::jsonB
WHERE role = 'admin';

-- Secure alimajzoub007@gmail.com again just in case
UPDATE public.profiles 
SET role = 'admin',
    permissions = '{
  "inventory": ["all"],
  "orders": ["all"],
  "customers": ["all"],
  "delivery": ["all"],
  "locations": ["all"],
  "settings": ["all"]
}'::jsonB
WHERE email = 'alimajzoub007@gmail.com';
