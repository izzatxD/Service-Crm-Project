CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'staff_account_auth_mode_enum'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'StaffAccountAuthMode'
  ) THEN
    ALTER TYPE staff_account_auth_mode_enum RENAME TO "StaffAccountAuthMode";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'StaffAccountAuthMode'
  ) THEN
    CREATE TYPE "StaffAccountAuthMode" AS ENUM (
      'password',
      'telegram',
      'password_and_telegram'
    );
  END IF;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE staff_members
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_staff_members_id_organization'
  ) THEN
    ALTER TABLE staff_members
      ADD CONSTRAINT uq_staff_members_id_organization
      UNIQUE (id, organization_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  staff_member_id UUID NOT NULL,
  login_identifier TEXT NOT NULL,
  password_hash TEXT NULL,
  telegram_user_id TEXT NULL,
  auth_mode "StaffAccountAuthMode" NOT NULL DEFAULT 'password',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  session_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TIMESTAMPTZ NULL,
  verified_at TIMESTAMPTZ NULL,
  legacy_user_id UUID NULL,
  legacy_password_identity_id UUID NULL,
  legacy_telegram_identity_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT staff_accounts_login_identifier_not_blank
    CHECK (btrim(login_identifier) <> ''),
  CONSTRAINT staff_accounts_password_hash_not_blank
    CHECK (password_hash IS NULL OR btrim(password_hash) <> ''),
  CONSTRAINT staff_accounts_telegram_user_id_not_blank
    CHECK (telegram_user_id IS NULL OR btrim(telegram_user_id) <> ''),
  CONSTRAINT staff_accounts_session_version_positive
    CHECK (session_version > 0),
  CONSTRAINT fk_staff_accounts_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_staff_accounts_staff_member
    FOREIGN KEY (staff_member_id, organization_id)
    REFERENCES staff_members(id, organization_id)
);

ALTER TABLE staff_accounts
  ADD CONSTRAINT uq_staff_accounts_id_organization
  UNIQUE (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_accounts_current_per_staff
  ON staff_accounts (staff_member_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_accounts_login_per_org
  ON staff_accounts (organization_id, lower(login_identifier))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_accounts_telegram_per_org
  ON staff_accounts (organization_id, telegram_user_id)
  WHERE telegram_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_accounts_org_active
  ON staff_accounts (organization_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_accounts_staff_member_active
  ON staff_accounts (staff_member_id, is_active)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_account_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_account_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT staff_account_password_reset_tokens_token_hash_not_blank
    CHECK (btrim(token_hash) <> ''),
  CONSTRAINT fk_staff_account_password_reset_tokens_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_staff_account_password_reset_tokens_account
    FOREIGN KEY (staff_account_id, organization_id)
    REFERENCES staff_accounts(id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_account_password_reset_tokens_token_hash
  ON staff_account_password_reset_tokens (token_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_account_password_reset_tokens_lookup
  ON staff_account_password_reset_tokens (organization_id, staff_account_id, expires_at)
  WHERE used_at IS NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_staff_accounts_set_updated_at ON staff_accounts;
CREATE TRIGGER trg_staff_accounts_set_updated_at
BEFORE UPDATE ON staff_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_staff_account_password_reset_tokens_set_updated_at
  ON staff_account_password_reset_tokens;
CREATE TRIGGER trg_staff_account_password_reset_tokens_set_updated_at
BEFORE UPDATE ON staff_account_password_reset_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE staff_accounts IS
  'Organization-scoped login accounts for staff_members. Phase 1 replacement for shared users auth.';

COMMENT ON TABLE staff_account_password_reset_tokens IS
  'Password reset tokens for organization-scoped staff accounts.';
