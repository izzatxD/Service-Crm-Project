BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUMS
-- Keep enums only for relatively stable workflow concepts.
-- =========================================================

CREATE TYPE staff_role_enum AS ENUM (
    'admin',
    'manager',
    'worker',
    'cashier',
    'viewer'
);

CREATE TYPE order_status_enum AS ENUM (
    'new',
    'pending_diagnosis',
    'estimated',
    'approved',
    'in_progress',
    'waiting_parts',
    'completed',
    'delivered',
    'cancelled'
);

CREATE TYPE task_status_enum AS ENUM (
    'pending',
    'in_progress',
    'waiting_parts',
    'completed',
    'cancelled'
);

CREATE TYPE order_priority_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

CREATE TYPE stock_movement_type_enum AS ENUM (
    'purchase',
    'usage',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'return_in',
    'return_out',
    'opening_balance',
    'correction'
);

CREATE TYPE auth_provider_enum AS ENUM (
    'password',
    'telegram'
);

-- =========================================================
-- HELPERS
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =========================================================
-- TABLES
-- =========================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    business_type_code TEXT NOT NULL DEFAULT 'auto_service',
    timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    currency_code CHAR(3) NOT NULL DEFAULT 'UZS',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT organizations_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT organizations_business_type_not_blank CHECK (btrim(business_type_code) <> ''),
    CONSTRAINT organizations_currency_code_upper CHECK (currency_code = upper(currency_code))
);

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    code TEXT NULL,
    name TEXT NOT NULL,
    phone TEXT NULL,
    address_line TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT branches_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT branches_code_not_blank CHECK (code IS NULL OR btrim(code) <> ''),
    CONSTRAINT fk_branches_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_branches_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NULL,
    phone TEXT NULL,
    email TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT users_full_name_not_blank CHECK (full_name IS NULL OR btrim(full_name) <> ''),
    CONSTRAINT users_phone_not_blank CHECK (phone IS NULL OR btrim(phone) <> ''),
    CONSTRAINT users_email_not_blank CHECK (email IS NULL OR btrim(email) <> '')
);

CREATE TABLE user_auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider auth_provider_enum NOT NULL,
    provider_user_id TEXT NOT NULL,
    password_hash TEXT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT user_auth_identities_provider_user_id_not_blank CHECK (btrim(provider_user_id) <> ''),
    CONSTRAINT user_auth_identities_password_hash_rule CHECK (
        (provider = 'password' AND password_hash IS NOT NULL AND btrim(password_hash) <> '')
        OR
        (provider = 'telegram' AND password_hash IS NULL)
    ),
    CONSTRAINT fk_user_auth_identities_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    primary_role staff_role_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    hired_at DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT staff_members_full_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT fk_staff_members_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_staff_members_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_staff_members_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_staff_members_organization_user UNIQUE (organization_id, user_id)
);

CREATE TABLE staff_branch_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    staff_member_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    active_from DATE NULL,
    active_to DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT staff_branch_assignments_active_dates_valid CHECK (
        active_to IS NULL OR active_from IS NULL OR active_to >= active_from
    ),
    CONSTRAINT fk_staff_branch_assignments_staff
        FOREIGN KEY (staff_member_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_staff_branch_assignments_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT uq_staff_branch_assignments UNIQUE (staff_member_id, branch_id)
);

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT clients_full_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT clients_phone_not_blank CHECK (phone IS NULL OR btrim(phone) <> ''),
    CONSTRAINT fk_clients_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_clients_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    client_id UUID NOT NULL,
    asset_type_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status_code TEXT NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT assets_asset_type_not_blank CHECK (btrim(asset_type_code) <> ''),
    CONSTRAINT assets_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT assets_status_code_not_blank CHECK (status_code IS NULL OR btrim(status_code) <> ''),
    CONSTRAINT fk_assets_client
        FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
    CONSTRAINT uq_assets_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE vehicle_profiles (
    asset_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    make TEXT NULL,
    model TEXT NULL,
    year INTEGER NULL,
    plate_number TEXT NULL,
    vin TEXT NULL,
    engine_type TEXT NULL,
    mileage INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT vehicle_profiles_year_valid CHECK (
        year IS NULL OR year BETWEEN 1900 AND EXTRACT(YEAR FROM NOW())::INTEGER + 1
    ),
    CONSTRAINT vehicle_profiles_plate_not_blank CHECK (plate_number IS NULL OR btrim(plate_number) <> ''),
    CONSTRAINT vehicle_profiles_vin_not_blank CHECK (vin IS NULL OR btrim(vin) <> ''),
    CONSTRAINT vehicle_profiles_engine_type_not_blank CHECK (engine_type IS NULL OR btrim(engine_type) <> ''),
    CONSTRAINT vehicle_profiles_mileage_non_negative CHECK (mileage IS NULL OR mileage >= 0),
    CONSTRAINT fk_vehicle_profiles_asset
        FOREIGN KEY (asset_id, organization_id) REFERENCES assets(id, organization_id)
);

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    code TEXT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT service_categories_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT service_categories_code_not_blank CHECK (code IS NULL OR btrim(code) <> ''),
    CONSTRAINT service_categories_sort_order_non_negative CHECK (sort_order >= 0),
    CONSTRAINT fk_service_categories_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_service_categories_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    category_id UUID NOT NULL,
    code TEXT NULL,
    name TEXT NOT NULL,
    default_labor_price NUMERIC(12,2) NULL,
    estimated_duration_minutes INTEGER NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT services_code_not_blank CHECK (code IS NULL OR btrim(code) <> ''),
    CONSTRAINT services_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT services_default_labor_price_non_negative CHECK (
        default_labor_price IS NULL OR default_labor_price >= 0
    ),
    CONSTRAINT services_estimated_duration_positive CHECK (
        estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
    ),
    CONSTRAINT fk_services_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_services_category
        FOREIGN KEY (category_id, organization_id) REFERENCES service_categories(id, organization_id),
    CONSTRAINT uq_services_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    order_number TEXT NOT NULL,
    client_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    created_by_staff_id UUID NOT NULL,
    assigned_manager_id UUID NULL,
    status order_status_enum NOT NULL DEFAULT 'new',
    priority order_priority_enum NOT NULL DEFAULT 'normal',
    customer_request_text TEXT NULL,
    intake_notes TEXT NULL,
    internal_diagnosis_text TEXT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT orders_order_number_not_blank CHECK (btrim(order_number) <> ''),
    CONSTRAINT orders_closed_at_after_opened_at CHECK (
        closed_at IS NULL OR closed_at >= opened_at
    ),
    CONSTRAINT orders_delivered_at_after_opened_at CHECK (
        delivered_at IS NULL OR delivered_at >= opened_at
    ),
    CONSTRAINT fk_orders_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_orders_client
        FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
    CONSTRAINT fk_orders_asset
        FOREIGN KEY (asset_id, organization_id) REFERENCES assets(id, organization_id),
    CONSTRAINT fk_orders_created_by_staff
        FOREIGN KEY (created_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_orders_assigned_manager
        FOREIGN KEY (assigned_manager_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT uq_orders_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE order_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_id UUID NOT NULL,
    line_no INTEGER NOT NULL,
    service_id UUID NULL,
    title TEXT NOT NULL,
    assigned_staff_id UUID NULL,
    status task_status_enum NOT NULL DEFAULT 'pending',
    estimated_labor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_labor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_tasks_line_no_positive CHECK (line_no > 0),
    CONSTRAINT order_tasks_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT order_tasks_estimated_labor_non_negative CHECK (estimated_labor_amount >= 0),
    CONSTRAINT order_tasks_actual_labor_non_negative CHECK (actual_labor_amount >= 0),
    CONSTRAINT order_tasks_completed_after_started CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT fk_order_tasks_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_order_tasks_service
        FOREIGN KEY (service_id, organization_id) REFERENCES services(id, organization_id),
    CONSTRAINT fk_order_tasks_assigned_staff
        FOREIGN KEY (assigned_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT uq_order_tasks_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_order_tasks_order_line UNIQUE (order_id, line_no)
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    sku TEXT NULL,
    name TEXT NOT NULL,
    item_type_code TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    default_cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    default_sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT inventory_items_sku_not_blank CHECK (sku IS NULL OR btrim(sku) <> ''),
    CONSTRAINT inventory_items_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT inventory_items_type_not_blank CHECK (btrim(item_type_code) <> ''),
    CONSTRAINT inventory_items_unit_not_blank CHECK (btrim(unit) <> ''),
    CONSTRAINT inventory_items_default_cost_non_negative CHECK (default_cost_price >= 0),
    CONSTRAINT inventory_items_default_sell_non_negative CHECK (default_sell_price >= 0),
    CONSTRAINT fk_inventory_items_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_inventory_items_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE inventory_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    quantity_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0,
    last_counted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT inventory_stocks_quantity_non_negative CHECK (quantity_on_hand >= 0),
    CONSTRAINT inventory_stocks_reserved_non_negative CHECK (reserved_quantity >= 0),
    CONSTRAINT inventory_stocks_reorder_non_negative CHECK (reorder_level >= 0),
    CONSTRAINT inventory_stocks_reserved_lte_on_hand CHECK (reserved_quantity <= quantity_on_hand),
    CONSTRAINT fk_inventory_stocks_item
        FOREIGN KEY (inventory_item_id, organization_id) REFERENCES inventory_items(id, organization_id),
    CONSTRAINT fk_inventory_stocks_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT uq_inventory_stocks_branch_item UNIQUE (branch_id, inventory_item_id)
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    movement_type stock_movement_type_enum NOT NULL,
    quantity_delta NUMERIC(14,3) NOT NULL,
    unit_cost_amount NUMERIC(12,2) NULL,
    reference_type TEXT NULL,
    reference_id UUID NULL,
    note TEXT NULL,
    created_by_staff_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_movements_quantity_delta_not_zero CHECK (quantity_delta <> 0),
    CONSTRAINT stock_movements_unit_cost_non_negative CHECK (
        unit_cost_amount IS NULL OR unit_cost_amount >= 0
    ),
    CONSTRAINT stock_movements_reference_type_not_blank CHECK (
        reference_type IS NULL OR btrim(reference_type) <> ''
    ),
    CONSTRAINT fk_stock_movements_item
        FOREIGN KEY (inventory_item_id, organization_id) REFERENCES inventory_items(id, organization_id),
    CONSTRAINT fk_stock_movements_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_stock_movements_created_by_staff
        FOREIGN KEY (created_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
);

CREATE TABLE order_task_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_task_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL,
    quantity NUMERIC(14,3) NOT NULL,
    unit_cost_amount NUMERIC(12,2) NOT NULL,
    unit_price_amount NUMERIC(12,2) NOT NULL,
    total_cost_amount NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_cost_amount, 2)) STORED,
    total_price_amount NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_price_amount, 2)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_task_parts_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_task_parts_unit_cost_non_negative CHECK (unit_cost_amount >= 0),
    CONSTRAINT order_task_parts_unit_price_non_negative CHECK (unit_price_amount >= 0),
    CONSTRAINT fk_order_task_parts_task
        FOREIGN KEY (order_task_id, organization_id) REFERENCES order_tasks(id, organization_id),
    CONSTRAINT fk_order_task_parts_item
        FOREIGN KEY (inventory_item_id, organization_id) REFERENCES inventory_items(id, organization_id)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_id UUID NOT NULL,
    payment_method_code TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by_staff_id UUID NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_method_not_blank CHECK (btrim(payment_method_code) <> ''),
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_payments_received_by_staff
        FOREIGN KEY (received_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
);

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    code TEXT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT expense_categories_code_not_blank CHECK (code IS NULL OR btrim(code) <> ''),
    CONSTRAINT expense_categories_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT fk_expense_categories_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_expense_categories_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    branch_id UUID NULL,
    expense_category_id UUID NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    related_order_id UUID NULL,
    created_by_staff_id UUID NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT expenses_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT expenses_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_expenses_category
        FOREIGN KEY (expense_category_id, organization_id) REFERENCES expense_categories(id, organization_id),
    CONSTRAINT fk_expenses_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_expenses_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_expenses_related_order
        FOREIGN KEY (related_order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_expenses_created_by_staff
        FOREIGN KEY (created_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
);

CREATE TABLE order_financials (
    order_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    subtotal_labor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal_parts_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_financials_subtotal_labor_non_negative CHECK (subtotal_labor_amount >= 0),
    CONSTRAINT order_financials_subtotal_parts_non_negative CHECK (subtotal_parts_amount >= 0),
    CONSTRAINT order_financials_discount_non_negative CHECK (discount_amount >= 0),
    CONSTRAINT order_financials_tax_non_negative CHECK (tax_amount >= 0),
    CONSTRAINT order_financials_grand_total_non_negative CHECK (grand_total_amount >= 0),
    CONSTRAINT fk_order_financials_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NULL,
    user_id UUID NULL,
    table_name TEXT NOT NULL,
    record_id UUID NULL,
    action_code TEXT NOT NULL,
    changes JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_logs_table_name_not_blank CHECK (btrim(table_name) <> ''),
    CONSTRAINT audit_logs_action_code_not_blank CHECK (btrim(action_code) <> ''),
    CONSTRAINT audit_logs_changes_is_object CHECK (
        changes IS NULL OR jsonb_typeof(changes) = 'object'
    ),
    CONSTRAINT fk_audit_logs_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE UNIQUE INDEX uq_branches_org_code_active
    ON branches (organization_id, lower(code))
    WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_email_active
    ON users (lower(email))
    WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_phone_active
    ON users (phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_user_auth_identities_provider_active
    ON user_auth_identities (provider, provider_user_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_user_auth_identities_primary_per_user
    ON user_auth_identities (user_id)
    WHERE is_primary = TRUE AND deleted_at IS NULL;

CREATE INDEX idx_staff_members_org_role_active
    ON staff_members (organization_id, primary_role, is_active)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_staff_branch_assignments_branch_active
    ON staff_branch_assignments (branch_id, staff_member_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_staff_branch_assignments_primary_per_staff
    ON staff_branch_assignments (staff_member_id)
    WHERE is_primary = TRUE AND deleted_at IS NULL;

CREATE INDEX idx_clients_phone
    ON clients (organization_id, phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_assets_client
    ON assets (organization_id, client_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_assets_type
    ON assets (organization_id, asset_type_code)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_vehicle_profiles_org_plate_active
    ON vehicle_profiles (organization_id, upper(plate_number))
    WHERE plate_number IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_vehicle_profiles_org_vin_active
    ON vehicle_profiles (organization_id, upper(vin))
    WHERE vin IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_service_categories_org_name_active
    ON service_categories (organization_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_services_org_name_active
    ON services (organization_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_services_org_code_active
    ON services (organization_id, lower(code))
    WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_inventory_items_org_sku_active
    ON inventory_items (organization_id, lower(sku))
    WHERE sku IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_inventory_items_org_name_active
    ON inventory_items (organization_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_stocks_branch_item_active
    ON inventory_stocks (branch_id, inventory_item_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_stock_movements_item_created_at
    ON stock_movements (inventory_item_id, created_at);

CREATE INDEX idx_stock_movements_branch_created_at
    ON stock_movements (branch_id, created_at);

CREATE INDEX idx_stock_movements_reference
    ON stock_movements (reference_type, reference_id)
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

CREATE UNIQUE INDEX uq_orders_org_order_number_active
    ON orders (organization_id, order_number)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_org_branch_status_opened
    ON orders (organization_id, branch_id, status, opened_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_org_client_opened
    ON orders (organization_id, client_id, opened_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_org_asset_opened
    ON orders (organization_id, asset_id, opened_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_org_manager_status
    ON orders (organization_id, assigned_manager_id, status)
    WHERE assigned_manager_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_order_tasks_org_order_status
    ON order_tasks (organization_id, order_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_tasks_org_assigned_staff_status
    ON order_tasks (organization_id, assigned_staff_id, status)
    WHERE assigned_staff_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_order_tasks_service
    ON order_tasks (service_id)
    WHERE service_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_order_task_parts_task
    ON order_task_parts (order_task_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_task_parts_inventory_item
    ON order_task_parts (inventory_item_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_payments_order_paid_at
    ON payments (order_id, paid_at);

CREATE INDEX idx_payments_received_by_paid_at
    ON payments (received_by_staff_id, paid_at)
    WHERE received_by_staff_id IS NOT NULL;

CREATE UNIQUE INDEX uq_expense_categories_org_name_active
    ON expense_categories (organization_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_expense_categories_org_code_active
    ON expense_categories (organization_id, lower(code))
    WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_expenses_org_date
    ON expenses (organization_id, expense_date);

CREATE INDEX idx_expenses_related_order
    ON expenses (related_order_id)
    WHERE related_order_id IS NOT NULL;

CREATE INDEX idx_audit_logs_org_created_at
    ON audit_logs (organization_id, created_at);

CREATE INDEX idx_audit_logs_table_record
    ON audit_logs (table_name, record_id);

-- =========================================================
-- UPDATED_AT TRIGGERS FOR MUTABLE TABLES
-- =========================================================

CREATE TRIGGER trg_organizations_set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_branches_set_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_auth_identities_set_updated_at
BEFORE UPDATE ON user_auth_identities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_members_set_updated_at
BEFORE UPDATE ON staff_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_branch_assignments_set_updated_at
BEFORE UPDATE ON staff_branch_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_clients_set_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assets_set_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vehicle_profiles_set_updated_at
BEFORE UPDATE ON vehicle_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_service_categories_set_updated_at
BEFORE UPDATE ON service_categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_services_set_updated_at
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_tasks_set_updated_at
BEFORE UPDATE ON order_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_items_set_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_stocks_set_updated_at
BEFORE UPDATE ON inventory_stocks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_task_parts_set_updated_at
BEFORE UPDATE ON order_task_parts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expense_categories_set_updated_at
BEFORE UPDATE ON expense_categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_financials_set_updated_at
BEFORE UPDATE ON order_financials
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
