-- Fix handle_new_user trigger to handle duplicate emails gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    CASE WHEN new.email = 'alimajzoub007@gmail.com' THEN 'admin'::app_role ELSE 'user'::app_role END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = now()
  ;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
