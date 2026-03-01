-- Create Shopify Settings Table
CREATE TABLE IF NOT EXISTS public.shopify_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    myshopify_url TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shopify_settings ENABLE ROW LEVEL SECURITY;

-- Policies
-- Only admins can see or manage shopify settings
DROP POLICY IF EXISTS "Admins can view shopify settings" ON public.shopify_settings;
CREATE POLICY "Admins can view shopify settings" 
ON public.shopify_settings FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can insert shopify settings" ON public.shopify_settings;
CREATE POLICY "Admins can insert shopify settings" 
ON public.shopify_settings FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can update shopify settings" ON public.shopify_settings;
CREATE POLICY "Admins can update shopify settings" 
ON public.shopify_settings FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can delete shopify settings" ON public.shopify_settings;
CREATE POLICY "Admins can delete shopify settings" 
ON public.shopify_settings FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);
