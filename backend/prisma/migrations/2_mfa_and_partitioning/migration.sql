-- Add MFA support fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isMfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaBackupCodes" JSON;

-- Partition events table by timestamp (monthly range partitioning)
-- First, create the partitioned table structure
CREATE TABLE IF NOT EXISTS "events_partitioned" (
    LIKE "events" INCLUDING ALL
) PARTITION BY RANGE ("timestamp");

-- Create monthly partitions for current and next 12 months
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE)::date;
    end_date DATE := (date_trunc('month', CURRENT_DATE) + interval '12 months')::date;
    current_date DATE := start_date;
    partition_name TEXT;
    partition_start TIMESTAMPTZ;
    partition_end TIMESTAMPTZ;
BEGIN
    WHILE current_date < end_date LOOP
        partition_name := 'events_' || to_char(current_date, 'YYYY_MM');
        partition_start := current_date;
        partition_end := current_date + interval '1 month';
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF "events_partitioned" FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            partition_start,
            partition_end
        );
        
        current_date := current_date + interval '1 month';
    END LOOP;
END $$;

-- Note: To fully migrate, you would need to:
-- 1. Rename existing events table
-- 2. Rename events_partitioned to events
-- 3. Copy data from old table to new partitioned table
-- This is a manual step to avoid data loss in production

-- Create index on timestamp for the partitioned table (inherited by partitions)
CREATE INDEX IF NOT EXISTS idx_events_partitioned_timestamp ON "events_partitioned" ("timestamp");
