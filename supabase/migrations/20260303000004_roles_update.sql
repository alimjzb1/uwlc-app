-- Add the new roles 'employee' and 'viewer' to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';

-- The role values 'warehouse_staff' and 'driver' will remain in the enum for 
-- legacy schema compatibility or historical data but typically won't be used in the UI anymore.
