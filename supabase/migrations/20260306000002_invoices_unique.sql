-- Add unique constraint on fleetrunnr_invoice_number to prevent duplicates at DB level
-- First, clean up any existing duplicates (keep the most recent one)
DELETE FROM invoices a
USING invoices b
WHERE a.id < b.id
  AND a.fleetrunnr_invoice_number IS NOT NULL
  AND a.fleetrunnr_invoice_number = b.fleetrunnr_invoice_number;

-- Add unique index (partial - only for non-null fleetrunnr_invoice_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_fleetrunnr_unique
ON invoices (fleetrunnr_invoice_number)
WHERE fleetrunnr_invoice_number IS NOT NULL;
