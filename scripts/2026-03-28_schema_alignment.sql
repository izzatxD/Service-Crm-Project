BEGIN;

ALTER TABLE orders
  ADD CONSTRAINT uq_orders_org_order_number
  UNIQUE (organization_id, order_number);

ALTER TABLE order_approvals
  ALTER COLUMN requested_by_staff_id SET NOT NULL;

ALTER TABLE order_approvals
  ADD COLUMN IF NOT EXISTS request_note TEXT NULL,
  ADD COLUMN IF NOT EXISTS decision_note TEXT NULL,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'order_approvals'
      AND column_name = 'note'
  ) THEN
    UPDATE order_approvals
    SET request_note = COALESCE(request_note, note)
    WHERE note IS NOT NULL;

    ALTER TABLE order_approvals
      DROP COLUMN note;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'order_approvals'
      AND column_name = 'approved_at'
  ) THEN
    UPDATE order_approvals
    SET decided_at = COALESCE(decided_at, approved_at)
    WHERE approved_at IS NOT NULL;

    ALTER TABLE order_approvals
      DROP COLUMN approved_at;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_approvals_approved_at_rule'
  ) THEN
    ALTER TABLE order_approvals
      DROP CONSTRAINT order_approvals_approved_at_rule;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_approvals_decided_at_rule'
  ) THEN
    ALTER TABLE order_approvals
      ADD CONSTRAINT order_approvals_decided_at_rule CHECK (
        (
          status IN ('approved', 'rejected')
          AND approved_by_staff_id IS NOT NULL
          AND decided_at IS NOT NULL
        )
        OR
        (
          status NOT IN ('approved', 'rejected')
          AND decided_at IS NULL
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_approvals_rejected_note_rule'
  ) THEN
    ALTER TABLE order_approvals
      ADD CONSTRAINT order_approvals_rejected_note_rule CHECK (
        status <> 'rejected' OR decision_note IS NOT NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payment_method_types_org'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE payment_method_types_org
      ADD COLUMN id UUID DEFAULT gen_random_uuid();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'payment_method_types_org'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'payment_method_types_org_pkey'
  ) THEN
    ALTER TABLE payment_method_types_org
      DROP CONSTRAINT IF EXISTS payment_method_types_org_pkey;

    ALTER TABLE payment_method_types_org
      ADD CONSTRAINT payment_method_types_org_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_payment_method_types_org'
  ) THEN
    ALTER TABLE payment_method_types_org
      ADD CONSTRAINT uq_payment_method_types_org UNIQUE (organization_id, payment_method_code);
  END IF;
END $$;

ALTER TABLE payment_method_types_org
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'order_financials'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE order_financials
      ADD COLUMN id UUID DEFAULT gen_random_uuid();
  END IF;
END $$;

ALTER TABLE order_financials
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'order_financials'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'order_financials_pkey'
  ) THEN
    ALTER TABLE order_financials
      DROP CONSTRAINT IF EXISTS order_financials_pkey;

    ALTER TABLE order_financials
      ADD CONSTRAINT order_financials_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_order_financials_order'
  ) THEN
    ALTER TABLE order_financials
      ADD CONSTRAINT uq_order_financials_order UNIQUE (order_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_approvals_pending_type
  ON order_approvals (order_id, approval_type_code)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_financials_org_balance_due
  ON order_financials (organization_id, balance_due_amount)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_payments_set_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_payments_set_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_expenses_set_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_expenses_set_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
