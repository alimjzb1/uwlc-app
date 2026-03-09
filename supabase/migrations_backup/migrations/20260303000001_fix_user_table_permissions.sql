-- Add alimajzoub007 to the public.users table as admin with full permissions if we're assuming "permissions" column handles access.
DO $$
DECLARE
  target_id UUID;
BEGIN
  -- Attempt to lookup the user id from auth.users (requires superuser/postgres access which this migration has)
  SELECT id INTO target_id FROM auth.users WHERE email = 'alimajzoub007@gmail.com' LIMIT 1;
  
  -- If we can't find them, we can't safely upsert into public.users.
  IF target_id IS NULL THEN
    RAISE NOTICE 'User alimajzoub007@gmail.com not found in auth.users';
  ELSE
    -- Check if users table even exists, as the screenshot indicates it does
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
      INSERT INTO public.users (id, role, permissions, settings)
      VALUES (
        target_id, 
        'admin', 
        '["all"]'::jsonb, 
        '{"theme":"system","density":"comfortable"}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET 
        role = EXCLUDED.role,
        permissions = EXCLUDED.permissions;
        
      RAISE NOTICE 'Upserted user into public.users';
    END IF;
    
    -- Also ensure they are strictly an admin in profiles, which our previous migration might have touched
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
      UPDATE public.profiles SET role = 'admin' WHERE id = target_id;
    END IF;
  END IF;
END $$;
