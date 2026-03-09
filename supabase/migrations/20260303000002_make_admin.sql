-- Explicitly grant admin privileges to the specified user
UPDATE public.profiles
SET role = 'admin'::app_role
WHERE email = 'alimajzoub007@gmail.com';
