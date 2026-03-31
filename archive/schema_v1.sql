BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUM DEFINITIONS
-- =========================================================

CREATE TYPE business_type_enum AS ENUM (
    'auto_service',
    'phone_repair',
    'appliance_repair',
    'veterinary_clinic',
    'field_service',
    'beauty_service',
    'other'
);

CREATE TYPE staff_role_enum AS ENUM (
    'admin',
    'manager',
    'worker',
    'cashier',
    'viewer'
);

CREATE TYPE asset_type_enum AS ENUM (
    'vehicle',
    'device',
    'appliance',
    'pet',
    'site',
    'person',
    'other'
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

CREATE TYPE inventory_item_type_enum AS ENUM (
    'part',
    'consumable',
    'other'
);

CREATE TYPE stock_movement_type_enum AS ENUM (
    'in',
    'out',
    'adjustment',
    'reserve',
    'release'
);

CREATE TYPE payment_method_enum AS ENUM (
    'cash',
    'card',
    'bank_transfer',
    'online',
    'mixed',
    'other'
);

CREATE TYPE audit_action_enum AS ENUM (
    'insert',
    'update',
    'delete',
    'login',
    'other'
);

-- =========================================================
-- HELPER FUNCTION
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
    business_type business_type_enum NOT NULL DEFAULT 'auto_service',
    timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    currency_code CHAR(3) NOT NULL DEFAULT 'UZS',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT organizations_name_not_blank CHECK (btrim(name) <> ''),
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
    CONSTRAINT fk_branches_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_branches_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NULL,
    phone TEXT NULL,
    email TEXT NULL,
    password_hash TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT users_email_not_blank CHECK (email IS NULL OR btrim(email) <> ''),
    CONSTRAINT users_phone_not_blank CHECK (phone IS NULL OR btrim(phone) <> ''),
    CONSTRAINT users_password_hash_not_blank CHECK (password_hash IS NULL OR btrim(password_hash) <> '')
);

CREATE TABLE staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    branch_id UUID NULL,
    user_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    role staff_role_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    hired_at DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT staff_members_full_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT fk_staff_members_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_staff_members_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_staff_members_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_staff_members_organization_user UNIQUE (organization_id, user_id),
    CONSTRAINT uq_staff_members_id_organization UNIQUE (id, organization_id)
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
    asset_type asset_type_enum NOT NULL,
    display_name TEXT NOT NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT assets_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT fk_assets_client
        FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
    CONSTRAINT uq_assets_id_client UNIQUE (id, client_id),
    CONSTRAINT uq_assets_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE vehicle_profiles (
    asset_id UUID PRIMARY KEY,
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
    CONSTRAINT vehicle_profiles_plate_not_blank CHECK (
        plate_number IS NULL OR btrim(plate_number) <> ''
    ),
    CONSTRAINT vehicle_profiles_vin_not_blank CHECK (
        vin IS NULL OR btrim(vin) <> ''
    ),
    CONSTRAINT vehicle_profiles_mileage_non_negative CHECK (
        mileage IS NULL OR mileage >= 0
    ),
    CONSTRAINT fk_vehicle_profiles_asset
        FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT service_categories_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT service_categories_sort_order_non_negative CHECK (sort_order >= 0),
    CONSTRAINT fk_service_categories_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_service_categories_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    category_id UUID NOT NULL,
    name TEXT NOT NULL,
    default_price NUMERIC(12,2) NULL,
    estimated_duration_minutes INTEGER NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT services_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT services_default_price_non_negative CHECK (
        default_price IS NULL OR default_price >= 0
    ),
    CONSTRAINT services_estimated_duration_positive CHECK (
        estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
    ),
    CONSTRAINT fk_services_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_services_category
        FOREIGN KEY (category_id, organization_id) REFERENCES service_categories(id, organization_id)
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    branch_id UUID NULL,
    sku TEXT NULL,
    name TEXT NOT NULL,
    item_type inventory_item_type_enum NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    quantity_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0,
    reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT inventory_items_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT inventory_items_unit_not_blank CHECK (btrim(unit) <> ''),
    CONSTRAINT inventory_items_sku_not_blank CHECK (sku IS NULL OR btrim(sku) <> ''),
    CONSTRAINT inventory_items_quantity_on_hand_non_negative CHECK (quantity_on_hand >= 0),
    CONSTRAINT inventory_items_reorder_level_non_negative CHECK (reorder_level >= 0),
    CONSTRAINT inventory_items_cost_price_non_negative CHECK (cost_price >= 0),
    CONSTRAINT inventory_items_sell_price_non_negative CHECK (sell_price >= 0),
    CONSTRAINT fk_inventory_items_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_inventory_items_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT uq_inventory_items_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL,
    organization_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    client_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    created_by_staff_id UUID NOT NULL,
    assigned_manager_id UUID NULL,
    status order_status_enum NOT NULL DEFAULT 'new',
    priority order_priority_enum NOT NULL DEFAULT 'normal',
    complaint_text TEXT NULL,
    diagnosis_text TEXT NULL,
    estimated_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT orders_order_number_not_blank CHECK (btrim(order_number) <> ''),
    CONSTRAINT orders_estimated_total_non_negative CHECK (estimated_total >= 0),
    CONSTRAINT orders_final_total_non_negative CHECK (final_total >= 0),
    CONSTRAINT orders_closed_at_after_opened_at CHECK (
        closed_at IS NULL OR closed_at >= opened_at
    ),
    CONSTRAINT fk_orders_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_orders_client
        FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
    CONSTRAINT fk_orders_asset_client
        FOREIGN KEY (asset_id, client_id) REFERENCES assets(id, client_id),
    CONSTRAINT fk_orders_created_by_staff
        FOREIGN KEY (created_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_orders_assigned_manager
        FOREIGN KEY (assigned_manager_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT uq_orders_order_number UNIQUE (order_number)
);

CREATE TABLE order_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    line_no INTEGER NOT NULL,
    service_id UUID NULL,
    custom_task_name TEXT NULL,
    assigned_worker_id UUID NULL,
    status task_status_enum NOT NULL DEFAULT 'pending',
    labor_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    estimated_labor_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_tasks_line_no_positive CHECK (line_no > 0),
    CONSTRAINT order_tasks_name_or_service_required CHECK (
        service_id IS NOT NULL OR (custom_task_name IS NOT NULL AND btrim(custom_task_name) <> '')
    ),
    CONSTRAINT order_tasks_labor_price_non_negative CHECK (labor_price >= 0),
    CONSTRAINT order_tasks_estimated_labor_price_non_negative CHECK (estimated_labor_price >= 0),
    CONSTRAINT order_tasks_completed_after_started CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT fk_order_tasks_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_order_tasks_service
        FOREIGN KEY (service_id) REFERENCES services(id),
    CONSTRAINT fk_order_tasks_assigned_worker
        FOREIGN KEY (assigned_worker_id) REFERENCES staff_members(id),
    CONSTRAINT uq_order_tasks_order_line UNIQUE (order_id, line_no)
);

CREATE TABLE order_task_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_task_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL,
    quantity NUMERIC(14,3) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    total_cost NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_cost, 2)) STORED,
    total_price NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_task_parts_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_task_parts_unit_cost_non_negative CHECK (unit_cost >= 0),
    CONSTRAINT order_task_parts_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT fk_order_task_parts_order_task
        FOREIGN KEY (order_task_id) REFERENCES order_tasks(id),
    CONSTRAINT fk_order_task_parts_inventory_item
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL,
    movement_type stock_movement_type_enum NOT NULL,
    quantity NUMERIC(14,3) NOT NULL,
    reference_type TEXT NULL,
    reference_id UUID NULL,
    note TEXT NULL,
    created_by_staff_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT stock_movements_quantity_positive CHECK (quantity > 0),
    CONSTRAINT stock_movements_reference_type_not_blank CHECK (
        reference_type IS NULL OR btrim(reference_type) <> ''
    ),
    CONSTRAINT fk_stock_movements_inventory_item
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
    CONSTRAINT fk_stock_movements_created_by_staff
        FOREIGN KEY (created_by_staff_id) REFERENCES staff_members(id)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    payment_method payment_method_enum NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by_staff_id UUID NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_payments_received_by_staff
        FOREIGN KEY (received_by_staff_id) REFERENCES staff_members(id)
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    branch_id UUID NULL,
    expense_type TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    related_order_id UUID NULL,
    created_by_staff_id UUID NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT expenses_expense_type_not_blank CHECK (btrim(expense_type) <> ''),
    CONSTRAINT expenses_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT expenses_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_expenses_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_expenses_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_expenses_related_order
        FOREIGN KEY (related_order_id) REFERENCES orders(id),
    CONSTRAINT fk_expenses_created_by_staff
        FOREIGN KEY (created_by_staff_id) REFERENCES staff_members(id)
);

CREATE TABLE order_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    subtotal_labor NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal_parts NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_financials_subtotal_labor_non_negative CHECK (subtotal_labor >= 0),
    CONSTRAINT order_financials_subtotal_parts_non_negative CHECK (subtotal_parts >= 0),
    CONSTRAINT order_financials_discount_non_negative CHECK (discount >= 0),
    CONSTRAINT order_financials_tax_non_negative CHECK (tax >= 0),
    CONSTRAINT order_financials_grand_total_non_negative CHECK (grand_total >= 0),
    CONSTRAINT fk_order_financials_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT uq_order_financials_order UNIQUE (order_id)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NULL,
    user_id UUID NULL,
    table_name TEXT NOT NULL,
    record_id UUID NULL,
    action audit_action_enum NOT NULL,
    changes JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT audit_logs_table_name_not_blank CHECK (btrim(table_name) <> ''),
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
    ON branches (organization_id, code)
    WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_email_active
    ON users ((lower(email)))
    WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_phone_active
    ON users (phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_telegram_user_id_active
    ON users (telegram_user_id)
    WHERE telegram_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_staff_members_organization_role_active
    ON staff_members (organization_id, role, is_active)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_staff_members_branch_active
    ON staff_members (branch_id, is_active)
    WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_clients_phone
    ON clients (phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_assets_client
    ON assets (client_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_vehicle_profiles_plate_number
    ON vehicle_profiles (plate_number)
    WHERE plate_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_vehicle_profiles_vin
    ON vehicle_profiles (vin)
    WHERE vin IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_service_categories_org_name_active
    ON service_categories (organization_id, name)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_services_org_category_name_active
    ON services (organization_id, category_id, name)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_inventory_items_org_sku_active_global
    ON inventory_items (organization_id, sku)
    WHERE sku IS NOT NULL AND branch_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_inventory_items_org_branch_sku_active
    ON inventory_items (organization_id, branch_id, sku)
    WHERE sku IS NOT NULL AND branch_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_inventory_items_name_active
    ON inventory_items (organization_id, name)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_organization_branch_status
    ON orders (organization_id, branch_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_client
    ON orders (client_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_asset
    ON orders (asset_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_orders_assigned_manager
    ON orders (assigned_manager_id)
    WHERE assigned_manager_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_orders_opened_at
    ON orders (opened_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_tasks_order_status
    ON order_tasks (order_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_tasks_assigned_worker
    ON order_tasks (assigned_worker_id)
    WHERE assigned_worker_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_order_task_parts_order_task
    ON order_task_parts (order_task_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_task_parts_inventory_item
    ON order_task_parts (inventory_item_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_stock_movements_inventory_item_created_at
    ON stock_movements (inventory_item_id, created_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_stock_movements_reference
    ON stock_movements (reference_type, reference_id)
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_payments_order_paid_at
    ON payments (order_id, paid_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_organization_date
    ON expenses (organization_id, expense_date)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_related_order
    ON expenses (related_order_id)
    WHERE related_order_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_audit_logs_organization_created_at
    ON audit_logs (organization_id, created_at);

CREATE INDEX idx_audit_logs_table_record
    ON audit_logs (table_name, record_id);

-- =========================================================
-- TRIGGERS
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

CREATE TRIGGER trg_staff_members_set_updated_at
BEFORE UPDATE ON staff_members
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

CREATE TRIGGER trg_inventory_items_set_updated_at
BEFORE UPDATE ON inventory_items
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

CREATE TRIGGER trg_order_task_parts_set_updated_at
BEFORE UPDATE ON order_task_parts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stock_movements_set_updated_at
BEFORE UPDATE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expenses_set_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_financials_set_updated_at
BEFORE UPDATE ON order_financials
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_audit_logs_set_updated_at
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
