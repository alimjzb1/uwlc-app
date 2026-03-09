-- Add access_token column to shopify_settings for storing the OAuth-obtained Admin API access token
ALTER TABLE public.shopify_settings ADD COLUMN IF NOT EXISTS access_token TEXT;
