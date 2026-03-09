-- Add metadata column to audit_logs if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='metadata') THEN
        ALTER TABLE audit_logs ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;
