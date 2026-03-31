BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TYPE auth_provider_enum AS ENUM (
    'password',
    'telegram'
);

CREATE TYPE stock_document_type_enum AS ENUM (
    'purchase_receipt',
    'branch_transfer',
    'stock_adjustment',
    'supplier_return',
    'customer_return',
    'opening_balance'
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

CREATE TYPE planned_part_status_enum AS ENUM (
    'planned',
    'reserved',
    'ordered',
    'received',
    'cancelled'
);

CREATE TYPE order_assignment_status_enum AS ENUM (
    'assigned',
    'accepted',
    'completed',
    'cancelled'
);

CREATE TYPE approval_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_vehicle_profile_asset_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_asset_type_code TEXT;
BEGIN
    SELECT asset_type_code
      INTO v_asset_type_code
      FROM assets
     WHERE id = NEW.asset_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;

    IF v_asset_type_code IS NULL THEN
        RAISE EXCEPTION 'Asset % not found for organization %', NEW.asset_id, NEW.organization_id;
    END IF;

    IF v_asset_type_code <> 'vehicle' THEN
        RAISE EXCEPTION 'vehicle_profiles can only reference assets with asset_type_code = vehicle';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_order_financial_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.grand_total_amount <> (NEW.subtotal_labor_amount + NEW.subtotal_parts_amount - NEW.discount_amount + NEW.tax_amount) THEN
        RAISE EXCEPTION 'grand_total_amount must equal subtotal_labor_amount + subtotal_parts_amount - discount_amount + tax_amount';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_staff_member_role_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_staff_organization_id UUID;
    v_role_organization_id UUID;
    v_is_system_role BOOLEAN;
BEGIN
    SELECT organization_id
      INTO v_staff_organization_id
      FROM staff_members
     WHERE id = NEW.staff_member_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;

    IF v_staff_organization_id IS NULL THEN
        RAISE EXCEPTION 'Staff member % not found for organization %', NEW.staff_member_id, NEW.organization_id;
    END IF;

    SELECT organization_id, is_system_role
      INTO v_role_organization_id, v_is_system_role
      FROM roles
     WHERE id = NEW.role_id
       AND deleted_at IS NULL;

    IF v_is_system_role IS NULL THEN
        RAISE EXCEPTION 'Role % not found', NEW.role_id;
    END IF;

    IF NOT v_is_system_role AND v_role_organization_id <> NEW.organization_id THEN
        RAISE EXCEPTION 'Role % does not belong to organization %', NEW.role_id, NEW.organization_id;
    END IF;

    RETURN NEW;
END;
$$;

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

CREATE TABLE platform_administrators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_code TEXT NOT NULL DEFAULT 'super_admin',
    can_manage_organizations BOOLEAN NOT NULL DEFAULT TRUE,
    can_manage_auth BOOLEAN NOT NULL DEFAULT TRUE,
    can_impersonate_users BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT platform_administrators_role_code_not_blank CHECK (btrim(role_code) <> ''),
    CONSTRAINT platform_administrators_note_not_blank CHECK (note IS NULL OR btrim(note) <> ''),
    CONSTRAINT fk_platform_administrators_user
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

CREATE TABLE business_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT business_types_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT business_types_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE asset_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT asset_types_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT asset_types_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE inventory_item_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT inventory_item_types_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT inventory_item_types_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE payment_method_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT payment_method_types_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT payment_method_types_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT roles_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT roles_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT roles_scope_valid CHECK (
        (is_system_role = TRUE AND organization_id IS NULL)
        OR
        (is_system_role = FALSE AND organization_id IS NOT NULL)
    ),
    CONSTRAINT fk_roles_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT permissions_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT permissions_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

CREATE TABLE staff_member_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    staff_member_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by_staff_id UUID NULL,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT staff_member_roles_expires_after_assigned CHECK (
        expires_at IS NULL OR expires_at >= assigned_at
    ),
    CONSTRAINT fk_staff_member_roles_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_staff_member_roles_staff
        FOREIGN KEY (staff_member_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_staff_member_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_staff_member_roles_assigned_by_staff
        FOREIGN KEY (assigned_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
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
    CONSTRAINT fk_assets_asset_type
        FOREIGN KEY (asset_type_code) REFERENCES asset_types(code),
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
    CONSTRAINT uq_orders_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_orders_org_order_number UNIQUE (organization_id, order_number)
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

CREATE TABLE order_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_id UUID NOT NULL,
    order_task_id UUID NULL,
    from_staff_id UUID NULL,
    to_staff_id UUID NOT NULL,
    assigned_by_staff_id UUID NOT NULL,
    accepted_by_staff_id UUID NULL,
    assignment_type_code TEXT NOT NULL DEFAULT 'task_assignment',
    status order_assignment_status_enum NOT NULL DEFAULT 'assigned',
    note TEXT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_assignments_assignment_type_not_blank CHECK (btrim(assignment_type_code) <> ''),
    CONSTRAINT order_assignments_accepted_after_assigned CHECK (
        accepted_at IS NULL OR accepted_at >= assigned_at
    ),
    CONSTRAINT order_assignments_completed_after_assigned CHECK (
        completed_at IS NULL OR completed_at >= assigned_at
    ),
    CONSTRAINT fk_order_assignments_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_order_assignments_task
        FOREIGN KEY (order_task_id, organization_id) REFERENCES order_tasks(id, organization_id),
    CONSTRAINT fk_order_assignments_from_staff
        FOREIGN KEY (from_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_order_assignments_to_staff
        FOREIGN KEY (to_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_order_assignments_assigned_by_staff
        FOREIGN KEY (assigned_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_order_assignments_accepted_by_staff
        FOREIGN KEY (accepted_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_id UUID NOT NULL,
    from_status order_status_enum NULL,
    to_status order_status_enum NOT NULL,
    changed_by_staff_id UUID NULL,
    note TEXT NULL,
    customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_status_history_status_change_required CHECK (
        from_status IS NULL OR from_status <> to_status
    ),
    CONSTRAINT fk_order_status_history_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_order_status_history_changed_by_staff
        FOREIGN KEY (changed_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
);

CREATE TABLE order_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_id UUID NOT NULL,
    approval_type_code TEXT NOT NULL,
    requested_by_staff_id UUID NOT NULL,
    approved_by_staff_id UUID NULL,
    status approval_status_enum NOT NULL DEFAULT 'pending',
    request_note TEXT NULL,
    decision_note TEXT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_approvals_type_not_blank CHECK (btrim(approval_type_code) <> ''),
    CONSTRAINT order_approvals_decided_at_rule CHECK (
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
    ),
    CONSTRAINT order_approvals_rejected_note_rule CHECK (
        status <> 'rejected' OR decision_note IS NOT NULL
    ),
    CONSTRAINT fk_order_approvals_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_order_approvals_requested_by_staff
        FOREIGN KEY (requested_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT fk_order_approvals_approved_by_staff
        FOREIGN KEY (approved_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
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
    CONSTRAINT fk_inventory_items_type
        FOREIGN KEY (item_type_code) REFERENCES inventory_item_types(code),
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

CREATE TABLE stock_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    document_type stock_document_type_enum NOT NULL,
    document_number TEXT NOT NULL,
    status_code TEXT NOT NULL DEFAULT 'posted',
    source_branch_id UUID NULL,
    destination_branch_id UUID NULL,
    created_by_staff_id UUID NULL,
    note TEXT NULL,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT stock_documents_number_not_blank CHECK (btrim(document_number) <> ''),
    CONSTRAINT stock_documents_status_code_not_blank CHECK (btrim(status_code) <> ''),
    CONSTRAINT stock_documents_transfer_rule CHECK (
        document_type <> 'branch_transfer'
        OR (source_branch_id IS NOT NULL AND destination_branch_id IS NOT NULL AND source_branch_id <> destination_branch_id)
    ),
    CONSTRAINT fk_stock_documents_branch
        FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_stock_documents_source_branch
        FOREIGN KEY (source_branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_stock_documents_destination_branch
        FOREIGN KEY (destination_branch_id, organization_id) REFERENCES branches(id, organization_id),
    CONSTRAINT fk_stock_documents_staff
        FOREIGN KEY (created_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id),
    CONSTRAINT uq_stock_documents_id_organization UNIQUE (id, organization_id)
);

CREATE TABLE stock_document_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    stock_document_id UUID NOT NULL,
    line_no INTEGER NOT NULL,
    inventory_item_id UUID NOT NULL,
    quantity NUMERIC(14,3) NOT NULL,
    unit_cost_amount NUMERIC(12,2) NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT stock_document_lines_line_no_positive CHECK (line_no > 0),
    CONSTRAINT stock_document_lines_quantity_positive CHECK (quantity > 0),
    CONSTRAINT stock_document_lines_unit_cost_non_negative CHECK (
        unit_cost_amount IS NULL OR unit_cost_amount >= 0
    ),
    CONSTRAINT fk_stock_document_lines_document
        FOREIGN KEY (stock_document_id, organization_id) REFERENCES stock_documents(id, organization_id),
    CONSTRAINT fk_stock_document_lines_item
        FOREIGN KEY (inventory_item_id, organization_id) REFERENCES inventory_items(id, organization_id),
    CONSTRAINT uq_stock_document_lines UNIQUE (stock_document_id, line_no)
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    stock_document_id UUID NULL,
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
    CONSTRAINT fk_stock_movements_document
        FOREIGN KEY (stock_document_id, organization_id) REFERENCES stock_documents(id, organization_id),
    CONSTRAINT fk_stock_movements_created_by_staff
        FOREIGN KEY (created_by_staff_id, organization_id) REFERENCES staff_members(id, organization_id)
);

CREATE TABLE planned_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_task_id UUID NOT NULL,
    inventory_item_id UUID NULL,
    part_name TEXT NOT NULL,
    quantity NUMERIC(14,3) NOT NULL,
    estimated_unit_cost_amount NUMERIC(12,2) NULL,
    estimated_unit_price_amount NUMERIC(12,2) NULL,
    status planned_part_status_enum NOT NULL DEFAULT 'planned',
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT planned_parts_name_not_blank CHECK (btrim(part_name) <> ''),
    CONSTRAINT planned_parts_quantity_positive CHECK (quantity > 0),
    CONSTRAINT planned_parts_estimated_unit_cost_non_negative CHECK (
        estimated_unit_cost_amount IS NULL OR estimated_unit_cost_amount >= 0
    ),
    CONSTRAINT planned_parts_estimated_unit_price_non_negative CHECK (
        estimated_unit_price_amount IS NULL OR estimated_unit_price_amount >= 0
    ),
    CONSTRAINT fk_planned_parts_task
        FOREIGN KEY (order_task_id, organization_id) REFERENCES order_tasks(id, organization_id),
    CONSTRAINT fk_planned_parts_item
        FOREIGN KEY (inventory_item_id, organization_id) REFERENCES inventory_items(id, organization_id)
);

CREATE TABLE order_extra_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    order_id UUID NOT NULL,
    order_task_id UUID NULL,
    charge_type_code TEXT NOT NULL,
    title TEXT NOT NULL,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_price_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_price_amount, 2)) STORED,
    note TEXT NULL,
    created_by_staff_id UUID NULL,
    customer_approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_extra_charges_type_not_blank CHECK (btrim(charge_type_code) <> ''),
    CONSTRAINT order_extra_charges_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT order_extra_charges_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_extra_charges_unit_price_non_negative CHECK (unit_price_amount >= 0),
    CONSTRAINT fk_order_extra_charges_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_order_extra_charges_task
        FOREIGN KEY (order_task_id, organization_id) REFERENCES order_tasks(id, organization_id),
    CONSTRAINT fk_order_extra_charges_staff
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

CREATE TABLE payment_method_types_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    payment_method_code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_payment_method_types_org_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_payment_method_types_org_method
        FOREIGN KEY (payment_method_code) REFERENCES payment_method_types(code),
    CONSTRAINT uq_payment_method_types_org UNIQUE (organization_id, payment_method_code)
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT fk_payments_method
        FOREIGN KEY (organization_id, payment_method_code) REFERENCES payment_method_types_org(organization_id, payment_method_code),
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    subtotal_labor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal_parts_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance_due_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT order_financials_subtotal_labor_non_negative CHECK (subtotal_labor_amount >= 0),
    CONSTRAINT order_financials_subtotal_parts_non_negative CHECK (subtotal_parts_amount >= 0),
    CONSTRAINT order_financials_discount_non_negative CHECK (discount_amount >= 0),
    CONSTRAINT order_financials_tax_non_negative CHECK (tax_amount >= 0),
    CONSTRAINT order_financials_grand_total_non_negative CHECK (grand_total_amount >= 0),
    CONSTRAINT order_financials_paid_total_non_negative CHECK (paid_total_amount >= 0),
    CONSTRAINT order_financials_balance_due_non_negative CHECK (balance_due_amount >= 0),
    CONSTRAINT fk_order_financials_order
        FOREIGN KEY (order_id, organization_id) REFERENCES orders(id, organization_id),
    CONSTRAINT uq_order_financials_order UNIQUE (order_id)
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

INSERT INTO business_types (code, name) VALUES
    ('auto_service', 'Auto Service'),
    ('phone_repair', 'Phone Repair'),
    ('appliance_repair', 'Appliance Repair'),
    ('veterinary_clinic', 'Veterinary Clinic'),
    ('field_service', 'Field Service'),
    ('beauty_service', 'Beauty Service'),
    ('other', 'Other');

INSERT INTO asset_types (code, name) VALUES
    ('vehicle', 'Vehicle'),
    ('device', 'Device'),
    ('appliance', 'Appliance'),
    ('pet', 'Pet'),
    ('site', 'Site'),
    ('person', 'Person'),
    ('other', 'Other');

INSERT INTO inventory_item_types (code, name) VALUES
    ('part', 'Part'),
    ('consumable', 'Consumable'),
    ('other', 'Other');

INSERT INTO payment_method_types (code, name) VALUES
    ('cash', 'Cash'),
    ('card', 'Card'),
    ('bank_transfer', 'Bank Transfer'),
    ('online', 'Online'),
    ('other', 'Other');

INSERT INTO roles (organization_id, code, name, description, is_system_role) VALUES
    (NULL, 'admin', 'Admin', 'Full system access.', TRUE),
    (NULL, 'manager', 'Manager', 'Runs branch operations and order flow.', TRUE),
    (NULL, 'worker', 'Worker', 'Executes assigned tasks and updates work progress.', TRUE),
    (NULL, 'cashier', 'Cashier', 'Handles payment intake and payment visibility.', TRUE),
    (NULL, 'viewer', 'Viewer', 'Read-only access to operational data.', TRUE);

INSERT INTO permissions (code, name, description) VALUES
    ('order.create', 'Create Orders', 'Create new service orders.'),
    ('order.read', 'Read Orders', 'View order lists and order details.'),
    ('order.update', 'Update Orders', 'Edit order details.'),
    ('order.assign', 'Assign Orders', 'Assign order work to staff members.'),
    ('order.approve', 'Approve Orders', 'Approve estimates or protected order actions.'),
    ('task.update', 'Update Tasks', 'Update task progress and notes.'),
    ('payment.create', 'Create Payments', 'Record customer payments.'),
    ('payment.read', 'Read Payments', 'View payment history and balances.'),
    ('expense.create', 'Create Expenses', 'Record expense transactions.'),
    ('inventory.read', 'Read Inventory', 'View stock levels and item lists.'),
    ('inventory.adjust', 'Adjust Inventory', 'Create stock adjustments and corrections.'),
    ('staff.read', 'Read Staff', 'View staff directory and assignments.'),
    ('staff.manage', 'Manage Staff', 'Create staff records and manage staff access.'),
    ('report.read', 'Read Reports', 'View dashboards and reports.'),
    ('system.settings', 'Manage System Settings', 'Manage organization-wide system settings.');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'order.create',
    'order.read',
    'order.update',
    'order.assign',
    'order.approve',
    'task.update',
    'payment.create',
    'payment.read',
    'expense.create',
    'inventory.read',
    'inventory.adjust',
    'staff.read',
    'staff.manage',
    'report.read',
    'system.settings'
)
WHERE r.code = 'admin'
  AND r.is_system_role = TRUE;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'order.create',
    'order.read',
    'order.update',
    'order.assign',
    'order.approve',
    'payment.read',
    'inventory.read',
    'staff.read',
    'report.read'
)
WHERE r.code = 'manager'
  AND r.is_system_role = TRUE;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'order.read',
    'task.update',
    'inventory.read'
)
WHERE r.code = 'worker'
  AND r.is_system_role = TRUE;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'order.read',
    'payment.create',
    'payment.read',
    'report.read'
)
WHERE r.code = 'cashier'
  AND r.is_system_role = TRUE;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'order.read',
    'payment.read',
    'inventory.read',
    'staff.read',
    'report.read'
)
WHERE r.code = 'viewer'
  AND r.is_system_role = TRUE;

ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_business_type
    FOREIGN KEY (business_type_code) REFERENCES business_types(code);

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

CREATE UNIQUE INDEX uq_platform_administrators_user_active
    ON platform_administrators (user_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_roles_system_code_active
    ON roles (lower(code))
    WHERE is_system_role = TRUE AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_roles_org_code_active
    ON roles (organization_id, lower(code))
    WHERE is_system_role = FALSE AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_permissions_code_active
    ON permissions (lower(code))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_staff_member_roles_active
    ON staff_member_roles (staff_member_id, role_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_staff_member_roles_org_staff_active
    ON staff_member_roles (organization_id, staff_member_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_staff_member_roles_role_active
    ON staff_member_roles (role_id)
    WHERE deleted_at IS NULL;

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

CREATE UNIQUE INDEX uq_stock_documents_org_number_active
    ON stock_documents (organization_id, document_number)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_stock_documents_branch_date
    ON stock_documents (branch_id, document_date)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_stock_movements_item_created_at
    ON stock_movements (inventory_item_id, created_at);

CREATE INDEX idx_stock_movements_branch_created_at
    ON stock_movements (branch_id, created_at);

CREATE INDEX idx_stock_movements_document
    ON stock_movements (stock_document_id)
    WHERE stock_document_id IS NOT NULL;

CREATE INDEX idx_stock_movements_reference
    ON stock_movements (reference_type, reference_id)
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

CREATE INDEX idx_planned_parts_task_status
    ON planned_parts (order_task_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_planned_parts_inventory_item
    ON planned_parts (inventory_item_id)
    WHERE inventory_item_id IS NOT NULL AND deleted_at IS NULL;

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

CREATE INDEX idx_order_assignments_order_assigned_at
    ON order_assignments (order_id, assigned_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_assignments_to_staff_status
    ON order_assignments (to_staff_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_status_history_order_created_at
    ON order_status_history (order_id, created_at)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_approvals_order_status
    ON order_approvals (order_id, status)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_order_approvals_pending_type
    ON order_approvals (order_id, approval_type_code)
    WHERE status = 'pending' AND deleted_at IS NULL;

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

CREATE INDEX idx_order_financials_org_balance_due
    ON order_financials (organization_id, balance_due_amount)
    WHERE deleted_at IS NULL;

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

CREATE INDEX idx_order_extra_charges_order
    ON order_extra_charges (order_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_order_extra_charges_task
    ON order_extra_charges (order_task_id)
    WHERE order_task_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_audit_logs_org_created_at
    ON audit_logs (organization_id, created_at);

CREATE INDEX idx_audit_logs_table_record
    ON audit_logs (table_name, record_id);

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

CREATE TRIGGER trg_platform_administrators_set_updated_at
BEFORE UPDATE ON platform_administrators
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

CREATE TRIGGER trg_business_types_set_updated_at
BEFORE UPDATE ON business_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_asset_types_set_updated_at
BEFORE UPDATE ON asset_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_item_types_set_updated_at
BEFORE UPDATE ON inventory_item_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payment_method_types_set_updated_at
BEFORE UPDATE ON payment_method_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_permissions_set_updated_at
BEFORE UPDATE ON permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_member_roles_set_updated_at
BEFORE UPDATE ON staff_member_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_member_roles_enforce_scope
BEFORE INSERT OR UPDATE ON staff_member_roles
FOR EACH ROW
EXECUTE FUNCTION enforce_staff_member_role_scope();

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

CREATE TRIGGER trg_vehicle_profiles_enforce_type
BEFORE INSERT OR UPDATE ON vehicle_profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_vehicle_profile_asset_type();

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

CREATE TRIGGER trg_order_assignments_set_updated_at
BEFORE UPDATE ON order_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_status_history_set_updated_at
BEFORE UPDATE ON order_status_history
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_approvals_set_updated_at
BEFORE UPDATE ON order_approvals
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

CREATE TRIGGER trg_stock_documents_set_updated_at
BEFORE UPDATE ON stock_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stock_document_lines_set_updated_at
BEFORE UPDATE ON stock_document_lines
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_planned_parts_set_updated_at
BEFORE UPDATE ON planned_parts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_extra_charges_set_updated_at
BEFORE UPDATE ON order_extra_charges
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_task_parts_set_updated_at
BEFORE UPDATE ON order_task_parts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payment_method_types_org_set_updated_at
BEFORE UPDATE ON payment_method_types_org
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expense_categories_set_updated_at
BEFORE UPDATE ON expense_categories
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

CREATE TRIGGER trg_order_financials_enforce_totals
BEFORE INSERT OR UPDATE ON order_financials
FOR EACH ROW
EXECUTE FUNCTION enforce_order_financial_totals();

COMMIT;
