-- Fix audit trigger: add ALL missing columns the trigger function expects
-- The trigger on orders/customers references columns not in the audit_logs table

-- Add all potentially missing columns
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS operation TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_by UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;

-- Recreate the trigger function to match the actual table schema
-- Drop the old one first (it may reference non-existent columns)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (table_name, record_id, action, operation, old_data, new_data, user_id, changed_by, changed_at)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW)::jsonb ELSE NULL END,
    COALESCE(auth.uid(), NULL),
    COALESCE(auth.uid(), NULL),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
