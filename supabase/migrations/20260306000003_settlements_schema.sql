-- Settlements table for tracking payouts from delivery companies to us
CREATE TABLE IF NOT EXISTS settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_number TEXT NOT NULL UNIQUE,
  delivery_company_id UUID REFERENCES delivery_companies(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'voided')),
  settlement_date DATE,
  fleetrunnr_payout_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for settlements
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Policies for settlements
DROP POLICY IF EXISTS "Enable read access for all users" ON settlements;
CREATE POLICY "Enable read access for all users" ON settlements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON settlements;
CREATE POLICY "Enable insert access for all users" ON settlements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON settlements;
CREATE POLICY "Enable update access for all users" ON settlements FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON settlements;
CREATE POLICY "Enable delete access for all users" ON settlements FOR DELETE USING (true);

-- Add linking columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_invoice_id') THEN
    ALTER TABLE orders ADD COLUMN delivery_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'settlement_id') THEN
    ALTER TABLE orders ADD COLUMN settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_settled') THEN
    ALTER TABLE orders ADD COLUMN is_settled BOOLEAN DEFAULT false;
  END IF;
END$$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_invoice_id ON orders(delivery_invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_settlement_id ON orders(settlement_id);
