-- Add MFA support fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isMfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaBackupCodes" JSON;

-- Note: Events table partitioning is a separate operational migration
-- that requires careful data migration and should be run during a
-- maintenance window. See docs/database-partitioning.md for procedure.
