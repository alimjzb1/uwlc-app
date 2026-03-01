-- One-time update for old orders
UPDATE orders 
SET internal_status = 'delivered' 
WHERE financial_status = 'paid' 
  AND fulfillment_status = 'fulfilled' 
  AND internal_status = 'new';
