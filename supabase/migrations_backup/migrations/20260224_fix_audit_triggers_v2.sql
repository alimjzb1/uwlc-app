-- Fix: The existing audit trigger inserts NULL for 'action' column
-- Make 'action' nullable and set default, then fix all audit triggers on orders

-- 1. Make action column nullable with a default
ALTER TABLE audit_logs ALTER COLUMN action DROP NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN action SET DEFAULT 'UNKNOWN';

-- 2. Drop ALL existing audit triggers on orders table so we can recreate cleanly
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_table = 'orders'
    AND trigger_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON orders', trigger_rec.trigger_name);
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
  END LOOP;
END $$;

-- 3. Drop ALL existing audit triggers on customers table
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_table = 'customers'
    AND trigger_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON customers', trigger_rec.trigger_name);
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
  END LOOP;
END $$;

-- 4. Drop ALL existing audit triggers on order_items table
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_table = 'order_items'
    AND trigger_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON order_items', trigger_rec.trigger_name);
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
  END LOOP;
END $$;

-- 5. Create a reliable audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (table_name, record_id, action, operation, old_data, new_data, user_id, changed_by, changed_at)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    TG_OP,
    CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    COALESCE(auth.uid(), NULL),
    COALESCE(auth.uid(), NULL),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Recreate triggers using the correct function
CREATE TRIGGER audit_orders_trigger
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_customers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_order_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
