-- Add missing roles to app_role enum if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'user', 'warehouse_staff', 'driver');
    ELSE
        -- Add warehouse_staff if not exists
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel = 'warehouse_staff') THEN
            ALTER TYPE app_role ADD VALUE 'warehouse_staff';
        END IF;
        
        -- Add driver if not exists
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel = 'driver') THEN
            ALTER TYPE app_role ADD VALUE 'driver';
        END IF;
    END IF;
END $$;

-- Update RLS policies on profiles table for admin management
-- Allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (
  role = 'admin'::app_role
  OR auth.uid() = id -- Keep default rule just in case (though public profiles viewable by everyone usually handles this)
);

-- Note: we already have "Public profiles are viewable by everyone" so we don't strictly *need* an admin-only SELECT policy, 
-- but we might want to allow admins to insert/update/delete.
-- Delete is restricted to admins only.
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" 
ON public.profiles FOR DELETE 
USING ( public.is_admin() );

-- Update is restricted to self AND admins
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING ( public.is_admin() );

-- Admins can insert profiles
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" 
ON public.profiles FOR INSERT 
WITH CHECK ( public.is_admin() );
