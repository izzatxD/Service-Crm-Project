WITH slug_candidates AS (
  SELECT
    org.id,
    org.created_at,
    COALESCE(
      NULLIF(
        trim(
          BOTH '-'
          FROM regexp_replace(lower(btrim(org.name)), '[^a-z0-9]+', '-', 'g')
        ),
        ''
      ),
      'organization'
    ) AS base_slug
  FROM organizations AS org
),
deduped_slugs AS (
  SELECT
    id,
    CASE
      WHEN row_number() OVER (PARTITION BY base_slug ORDER BY created_at, id) = 1
        THEN base_slug
      ELSE base_slug || '-' ||
        row_number() OVER (PARTITION BY base_slug ORDER BY created_at, id)
    END AS resolved_slug
  FROM slug_candidates
)
UPDATE organizations AS org
SET slug = deduped_slugs.resolved_slug
FROM deduped_slugs
WHERE org.id = deduped_slugs.id
  AND (org.slug IS NULL OR btrim(org.slug) = '');

UPDATE organizations
SET slug = lower(btrim(slug))
WHERE slug IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM organizations
    WHERE slug IS NULL OR btrim(slug) = ''
  ) THEN
    RAISE EXCEPTION 'Organization slug backfill failed. Every organization must have a slug before cutover.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_slug_not_blank'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_slug_not_blank
      CHECK (btrim(slug) <> '');
  END IF;
END $$;

ALTER TABLE organizations
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_slug_active
  ON organizations (lower(slug))
  WHERE deleted_at IS NULL;

WITH password_identities AS (
  SELECT DISTINCT ON (user_id)
    id,
    user_id,
    provider_user_id,
    password_hash,
    verified_at,
    is_primary,
    created_at
  FROM user_auth_identities
  WHERE provider = 'password'
    AND deleted_at IS NULL
  ORDER BY user_id, is_primary DESC, created_at ASC
),
telegram_identities AS (
  SELECT DISTINCT ON (user_id)
    id,
    user_id,
    provider_user_id,
    verified_at,
    is_primary,
    created_at
  FROM user_auth_identities
  WHERE provider = 'telegram'
    AND deleted_at IS NULL
  ORDER BY user_id, is_primary DESC, created_at ASC
),
source_accounts AS (
  SELECT
    sm.id AS staff_member_id,
    sm.organization_id,
    COALESCE(
      NULLIF(lower(btrim(pi.provider_user_id)), ''),
      NULLIF(lower(btrim(u.email)), ''),
      'staff-' || substr(sm.organization_id::text, 1, 8) || '-' || substr(sm.id::text, 1, 8)
    ) AS login_identifier,
    pi.password_hash,
    NULLIF(btrim(ti.provider_user_id), '') AS telegram_user_id,
    CASE
      WHEN pi.id IS NOT NULL AND ti.id IS NOT NULL THEN 'password_and_telegram'::staff_account_auth_mode_enum
      WHEN ti.id IS NOT NULL THEN 'telegram'::staff_account_auth_mode_enum
      ELSE 'password'::staff_account_auth_mode_enum
    END AS auth_mode,
    CASE
      WHEN pi.id IS NULL AND ti.id IS NULL THEN FALSE
      ELSE sm.is_active
        AND org.is_active
        AND COALESCE(u.is_active, TRUE)
    END AS is_active,
    CASE
      WHEN pi.id IS NULL AND ti.id IS NULL THEN TRUE
      ELSE FALSE
    END AS must_change_password,
    u.last_login_at,
    COALESCE(pi.verified_at, ti.verified_at) AS verified_at,
    u.id AS legacy_user_id,
    pi.id AS legacy_password_identity_id,
    ti.id AS legacy_telegram_identity_id,
    COALESCE(sm.deleted_at, org.deleted_at, u.deleted_at) AS deleted_at
  FROM staff_members AS sm
  INNER JOIN organizations AS org
    ON org.id = sm.organization_id
  LEFT JOIN users AS u
    ON u.id = sm.user_id
  LEFT JOIN password_identities AS pi
    ON pi.user_id = sm.user_id
  LEFT JOIN telegram_identities AS ti
    ON ti.user_id = sm.user_id
)
INSERT INTO staff_accounts (
  organization_id,
  staff_member_id,
  login_identifier,
  password_hash,
  telegram_user_id,
  auth_mode,
  is_active,
  must_change_password,
  last_login_at,
  verified_at,
  legacy_user_id,
  legacy_password_identity_id,
  legacy_telegram_identity_id,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  source_accounts.organization_id,
  source_accounts.staff_member_id,
  source_accounts.login_identifier,
  source_accounts.password_hash,
  source_accounts.telegram_user_id,
  source_accounts.auth_mode,
  source_accounts.is_active,
  source_accounts.must_change_password,
  source_accounts.last_login_at,
  source_accounts.verified_at,
  source_accounts.legacy_user_id,
  source_accounts.legacy_password_identity_id,
  source_accounts.legacy_telegram_identity_id,
  NOW(),
  NOW(),
  source_accounts.deleted_at
FROM source_accounts
WHERE NOT EXISTS (
  SELECT 1
  FROM staff_accounts AS existing_account
  WHERE existing_account.staff_member_id = source_accounts.staff_member_id
    AND existing_account.deleted_at IS NOT DISTINCT FROM source_accounts.deleted_at
);

COMMENT ON TABLE users IS
  'Legacy global auth table. Phase 1 keeps it for platform administrators and audit history.';

COMMENT ON TABLE user_auth_identities IS
  'Legacy global auth identities. Deprecated for organization staff after staff_accounts cutover.';
