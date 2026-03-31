# Database README

This database is designed for a service-business management platform with an immediate focus on auto-service workshops, while keeping the core schema reusable for other service businesses.

## Design Goals

- Production-minded PostgreSQL schema
- Multi-organization and multi-branch ready
- Universal `client -> asset -> order -> order_tasks` structure
- Staff and role model that supports admin, manager, worker, cashier, and viewer
- Inventory, payments, expenses, and audit support
- Auto-service specific fields isolated in extension tables

## Table Purposes

### Tenant and Access Layer

- `organizations`
  - Top-level business entity.
  - Holds the business type and shared settings like timezone and currency.

- `branches`
  - Physical or operational branches of one organization.
  - Enables future multi-workshop support.

- `users`
  - Base login identity.
  - Supports web login and future Telegram login through nullable `telegram_user_id`.
  - `email`, `phone`, and `password_hash` are flexible so multiple auth flows can coexist.

- `platform_administrators`
  - Platform-level access for the product owner or trusted support admins.
  - Separate from organization staff roles.
  - Lets the creator manage organizations, auth flows, and support access across all tenants.

- `staff_members`
  - Organization-level staff profile attached to a `user`.
  - Stores role, branch assignment, active state, and hiring date.

- `roles`, `permissions`, `role_permissions`, `staff_member_roles`
  - Foundation for future RBAC and multi-role support.
  - `staff_members.primary_role` can still power the MVP while backend gradually moves to permission checks.

### Universal CRM and Service Objects

- `clients`
  - Customer master data.
  - Shared across all service-business types.

- `assets`
  - Universal service object owned by a client.
  - Examples:
    - auto-service: vehicle
    - phone repair: device
    - appliance repair: appliance
    - veterinary: pet
    - field service: site
    - beauty: person

### Auto-Service Extension

- `vehicle_profiles`
  - Auto-service specific 1-to-1 extension of `assets`.
  - Keeps car fields out of the universal `assets` table.
  - Stores make, model, year, plate number, VIN, engine type, and mileage.

### Service Catalog

- `service_categories`
  - Groups services into logical business categories like diagnostics, engine, electrical, oil service.

- `services`
  - Service catalog items that may be added into `order_tasks`.
  - Stores default price and estimated duration.

### Operational Workflow

- `orders`
  - Main repair/service order.
  - Connects organization, branch, client, asset, and responsible staff.
  - Holds status, totals, complaint, diagnosis, and timestamps.

- `order_tasks`
  - Individual job lines inside an order.
  - Supports multiple tasks per order and per-task worker assignment.
  - Can use a catalog service or a custom task name.

- `order_task_parts`
  - Tracks which inventory items were consumed by a task.
  - Stores pricing snapshot at usage time.

### Inventory

- `inventory_items`
  - Universal inventory catalog and stock record.
  - Can be organization-level or branch-level.
  - Supports parts, consumables, and other items.

- `stock_movements`
  - Inventory ledger.
  - Tracks stock in, stock out, adjustments, reserve, and release events.

### Finance

- `payments`
  - Payments received for an order.
  - Supports multiple payments and payment methods.

- `expenses`
  - Operating expenses at organization or branch level.
  - Can optionally be related to an order.

- `order_financials`
  - Final financial snapshot of an order.
  - Stores labor subtotal, parts subtotal, discount, tax, and grand total.

### Audit

- `audit_logs`
  - Minimal change logging table.
  - Intended as a simple base for compliance and accountability.

## Universal vs Auto-Service Specific

### Universal Tables

- `organizations`
- `branches`
- `users`
- `staff_members`
- `clients`
- `assets`
- `service_categories`
- `services`
- `orders`
- `order_tasks`
- `order_task_parts`
- `inventory_items`
- `stock_movements`
- `payments`
- `expenses`
- `order_financials`
- `audit_logs`

### Auto-Service Specific Tables

- `vehicle_profiles`

## How to Extend for Other Service Businesses

The main extension strategy is:

1. Keep `clients`, `assets`, `orders`, `order_tasks`, inventory, and finance tables unchanged.
2. Add asset-profile extension tables for niche-specific data.
3. Add optional workflow tables only if the niche needs deeper domain logic.
4. Keep service catalog and order flow consistent across verticals whenever possible.

### Phone Repair

Recommended additions:

- `device_profiles`
  - 1-to-1 with `assets`
  - Suggested fields:
    - `brand`
    - `model`
    - `serial_number`
    - `imei`
    - `color`
    - `storage_capacity`
    - `lock_status`
    - `battery_health`

- `device_intake_checks`
  - Optional order-level or asset-level checklist
  - Suggested fields:
    - screen condition
    - face id / fingerprint status
    - charging status
    - water damage note
    - accessories received

Why this fits:
- `assets` stays universal.
- Phone-specific fields live in `device_profiles`.
- Repairs still flow through `orders` and `order_tasks`.

### Veterinary Clinic

Recommended additions:

- `pet_profiles`
  - 1-to-1 with `assets`
  - Suggested fields:
    - `species`
    - `breed`
    - `sex`
    - `birth_date`
    - `weight`
    - `color`
    - `microchip_number`

- `appointments`
  - Optional scheduling layer
  - Useful if the clinic operates on booked visits.

- `medical_records`
  - Clinical history linked to asset or order
  - Suggested fields:
    - symptoms
    - examination findings
    - treatment plan
    - prescriptions

Why this fits:
- The owner remains `clients`.
- The animal becomes an `asset`.
- Consultation or treatment becomes an `order`.

### Beauty Service

Main differences:

- `assets` may represent the serviced person, or you may operate with `asset_type = person`.
- Beauty businesses often need stronger appointment and staff-schedule support than asset-specific profiling.

Recommended changes and additions:

- Keep `clients` unchanged.
- Use `assets` only if you want a formal serviced object per client.
  - Example: `asset_type = person`
  - `display_name` can mirror the client name or be used for separate profiles.

- Add `appointments`
  - Suggested fields:
    - `organization_id`
    - `branch_id`
    - `client_id`
    - `staff_member_id`
    - `service_id`
    - `starts_at`
    - `ends_at`
    - `status`

- Add `staff_availability`
  - Useful for booking logic and calendar management.

- Optionally add `client_preferences`
  - Suggested fields:
    - preferred stylist
    - allergy notes
    - color formula note
    - style history

What changes in current schema:
- Core order and payment model can remain the same.
- `order_tasks` may become simpler because many beauty flows need fewer parts and more scheduling.
- Inventory still works for consumables like hair color, creams, and salon products.

## Production-Minded Notes

- The schema uses UUID primary keys for distributed-safe identity generation.
- `deleted_at` is included for soft delete support on the main tables.
- Partial indexes are used to keep uniqueness practical with soft delete.
- Tenant boundaries are reinforced through organization-aware foreign keys where important.
- `order_number` remains app-generated but is protected by a unique constraint in the database.
- `order_task_parts` stores price snapshots so historical reporting stays correct even if item prices later change.
- `stock_movements` acts as an auditable ledger instead of relying only on current quantity fields.

## Recommended Next Database Steps

- Add appointment and scheduling tables if the product will support booking workflows soon.
- Add reporting views for revenue, margin, unpaid balances, and branch performance.
- Add database-level audit triggers later if stronger compliance is needed.
- Add reference tables for expense categories, payment providers, and tax rules if accounting complexity grows.

## Schema Upgrade Notes

- Use `schema.sql` when initializing a brand-new database from scratch.
- Use `scripts/2026-03-28_schema_alignment.sql` when upgrading an existing database that was created from an older schema revision.
- The alignment script is written to be mostly idempotent and focuses on order approvals, payments, expenses, payment-method organization mapping, and order financial structure.

## Auth Flow Guidance

Recommended login resolution order for backend:

1. Authenticate user from `user_auth_identities`.
2. Load the base `users` record.
3. Check `platform_administrators`.
   - If active record exists, mark session as platform-level.
   - Platform admins are above organization roles.
4. If request is organization-scoped, load matching `staff_members` row.
5. Build permissions from:
   - `staff_members.primary_role` for MVP compatibility
   - plus `staff_member_roles -> role_permissions -> permissions` when RBAC is enabled

Suggested session shape:

- `user_id`
- `is_platform_admin`
- `platform_permissions`
- `organization_id`
- `staff_member_id`
- `primary_role`
- `permission_codes`

Important rule:

- `platform_administrators` should not automatically behave like organization staff unless you explicitly attach that user to an organization via `staff_members`.
