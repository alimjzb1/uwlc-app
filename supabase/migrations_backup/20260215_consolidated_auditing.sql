-- Consolidated Auditing Columns
-- Run this in your Supabase SQL Editor to ensure auditing works correctly.

-- 1. Ensure metadata column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='metadata') THEN
        ALTER TABLE audit_logs ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- 2. Ensure reason column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='reason') THEN
        ALTER TABLE audit_logs ADD COLUMN reason TEXT;
    END IF;
END $$;

-- 3. Ensure old_data and new_data are JSONB (they usually are, but just in case)
ALTER TABLE audit_logs ALTER COLUMN old_data TYPE JSONB USING old_data::jsonb;
ALTER TABLE audit_logs ALTER COLUMN new_data TYPE JSONB USING new_data::jsonb;
