-- Update existing voided orders to 'cancelled' status
UPDATE orders 
SET internal_status = 'cancelled' 
WHERE financial_status = 'voided' AND internal_status != 'cancelled';
