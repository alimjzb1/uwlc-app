-- Deduplicate Customers and Add Unique Constraint

-- 1. Deduplicate customers (keep the most recently updated one for each shopify_customer_id)
-- Since `orders` references `customer_id`, we must re-point any existing orders to the primary customer record.

DO $$
DECLARE
    target_record RECORD;
    duplicate_record RECORD;
    primary_id UUID;
BEGIN
    -- Iterate over each shopify_customer_id that has duplicates
    FOR target_record IN 
        SELECT shopify_customer_id
        FROM public.customers 
        WHERE shopify_customer_id IS NOT NULL
        GROUP BY shopify_customer_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Find the primary ID (the one with the latest update)
        SELECT id INTO primary_id
        FROM public.customers
        WHERE shopify_customer_id = target_record.shopify_customer_id
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1;

        -- Find all duplicate IDs for this shopify_customer_id
        FOR duplicate_record IN 
            SELECT id 
            FROM public.customers 
            WHERE shopify_customer_id = target_record.shopify_customer_id
            AND id != primary_id
        LOOP
            -- Re-point orders to the primary customer
            UPDATE public.orders 
            SET customer_id = primary_id 
            WHERE customer_id = duplicate_record.id;
            
            -- Delete the duplicate customer
            DELETE FROM public.customers WHERE id = duplicate_record.id;
        END LOOP;
    END LOOP;
END $$;

-- 2. Add the unique constraint to ensure no future duplicates
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_shopify_customer_id_key;
ALTER TABLE public.customers ADD CONSTRAINT customers_shopify_customer_id_key UNIQUE (shopify_customer_id);
