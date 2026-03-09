-- Invoices table for tracking both manual and Fleetrunnr-sourced invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('received', 'sent')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'fleetrunnr')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'voided', 'overdue')),
  delivery_company_id UUID REFERENCES delivery_companies(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date DATE,
  notes TEXT,
  related_order_ids TEXT[],
  fleetrunnr_invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON invoices;
CREATE POLICY "Enable read access for all users" ON invoices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON invoices;
CREATE POLICY "Enable insert access for all users" ON invoices FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON invoices;
CREATE POLICY "Enable update access for all users" ON invoices FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON invoices;
CREATE POLICY "Enable delete access for all users" ON invoices FOR DELETE USING (true);

-- Add delivery finance columns to orders table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cash_collection_amount') THEN
    ALTER TABLE orders ADD COLUMN cash_collection_amount NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_fee') THEN
    ALTER TABLE orders ADD COLUMN delivery_fee NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cash_collected') THEN
    ALTER TABLE orders ADD COLUMN cash_collected BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'settlement_date') THEN
    ALTER TABLE orders ADD COLUMN settlement_date TIMESTAMPTZ;
  END IF;
END$$;

-- Add delivery_fee column to delivery_companies if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_companies' AND column_name = 'default_delivery_fee') THEN
    ALTER TABLE delivery_companies ADD COLUMN default_delivery_fee NUMERIC DEFAULT 0;
  END IF;
END$$;
