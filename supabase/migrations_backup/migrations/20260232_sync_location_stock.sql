-- Migration: Sync Location Stock to Global Stock

-- Create function to update global stock based on location levels
CREATE OR REPLACE FUNCTION sync_global_stock_from_locations()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT/UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE products_inventory
    SET quantity_on_hand = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM inventory_levels
      WHERE product_id = NEW.product_id
    )
    WHERE id = NEW.product_id;
    RETURN NEW;
  
  -- Handle DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE products_inventory
    SET quantity_on_hand = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM inventory_levels
      WHERE product_id = OLD.product_id
    )
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then create it
DROP TRIGGER IF EXISTS trigger_sync_global_stock ON inventory_levels;
CREATE TRIGGER trigger_sync_global_stock
AFTER INSERT OR UPDATE OR DELETE ON inventory_levels
FOR EACH ROW EXECUTE FUNCTION sync_global_stock_from_locations();

-- Initialize existing global stock to match current location levels
UPDATE products_inventory p
SET quantity_on_hand = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM inventory_levels l
    WHERE l.product_id = p.id
);
