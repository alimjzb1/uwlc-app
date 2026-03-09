-- Update default permissions to include the new invoices module
-- This ensures that existing employees/users can be granted access to Invoices via the UI

-- 1. Update the default value for the column for new profiles
ALTER TABLE public.profiles ALTER COLUMN permissions SET DEFAULT '{
  "inventory": ["read"],
  "orders": ["read"],
  "customers": ["read"],
  "delivery": ["read"],
  "locations": ["read"],
  "invoices": ["read"]
}'::jsonb;

-- 2. Retroactively update existing profiles to include invoices: ["read"] if they have the standard default set
-- We search for profiles that have "inventory": ["read"] but missing "invoices"
UPDATE public.profiles
SET permissions = jsonb_set(permissions, '{invoices}', '["read"]'::jsonb)
WHERE NOT (permissions ? 'invoices')
  AND role != 'admin';

-- 3. Ensure admins have "all" for invoices as well
UPDATE public.profiles
SET permissions = jsonb_set(permissions, '{invoices}', '["all"]'::jsonb)
WHERE role = 'admin'
  AND (NOT (permissions ? 'invoices') OR permissions->'invoices' != '["all"]');
