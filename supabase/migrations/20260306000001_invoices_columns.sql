-- Add merchant_name column to invoices for search/display
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS merchant_name text;

-- Add invoice_date column to store the original Fleetrunnr invoice date
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date timestamptz;

-- Add subtotal column
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;

-- Add order_count column
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_count integer DEFAULT 0;
