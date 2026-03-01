-- Add delivery and payment details to public.orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
