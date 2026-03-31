# Backend

Professional NestJS + PostgreSQL + Prisma backend foundation for the CRM platform.

## Stack

- NestJS
- Prisma
- PostgreSQL
- JWT auth
- Swagger

## Implemented Foundation

- global config with env validation
- Prisma module
- JWT auth with `login` and `me`
- platform admin support
- organizations and branches
- staff and RBAC
- clients and assets
- orders and workflow tables
- inventory
- finance
- route-level permission guard foundation

## Quick Start

1. Copy env:

```powershell
Copy-Item .env.example .env
```

2. Start PostgreSQL:

```powershell
docker compose up -d
```

3. Generate Prisma client:

```powershell
npm run prisma:generate
```

4. Push schema:

```powershell
npm run prisma:push
```

5. Seed defaults:

```powershell
npm run prisma:seed
```

6. Start backend:

```powershell
npm run start:dev
```

Workflow rule tests:

```powershell
npm run test:workflow
```

## Verification

Before pushing backend changes, run:

```powershell
npm run lint
npm run build
npm run test -- --runInBand
npm run test:e2e
```

If you are at the workspace root, the same checks are available via:

```powershell
npm run verify:backend
```

## Seeded Defaults

- system permissions
- system roles
- role-permission mappings
- organization payment methods
- optional platform super admin
- optional demo organization, branch, and staff accounts

Optional platform admin seed:

- `SEED_PLATFORM_ENABLED=true`
- `SEED_PLATFORM_EMAIL`
- `SEED_PLATFORM_PASSWORD`
- `SEED_PLATFORM_NAME`

If another active `super_admin` already exists, the seed skips creating a second one.

Optional demo seed:

- `SEED_DEMO_ENABLED=true`
- `SEED_DEMO_ORG_NAME`
- `SEED_DEMO_ORG_SLUG`
- `SEED_DEMO_BRANCH_NAME`
- `SEED_DEMO_BRANCH_CODE`
- `SEED_DEMO_PASSWORD`
- `SEED_DEMO_EMAIL_PREFIX`
- `SEED_DEMO_PHONE_PREFIX`

When `SEED_DEMO_ENABLED=true`, the seed creates:

- 1 demo organization
- 1 demo branch
- 5 demo staff accounts for `admin`, `manager`, `worker`, `cashier`, `viewer`

Default demo logins:

- `demo+admin@crm.local`
- `demo+manager@crm.local`
- `demo+worker@crm.local`
- `demo+cashier@crm.local`
- `demo+viewer@crm.local`

Default demo password:

- `Demo12345!`

Staff demo accounts and platform admins both log in with `loginIdentifier + password`.

## Current API Areas

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST|PATCH|DELETE /api/organizations`
- `GET|POST|PATCH|DELETE /api/branches`
- `GET|POST|PATCH|DELETE /api/staff`
- `GET|POST|PATCH|DELETE /api/rbac/roles`
- `GET|POST|PATCH|DELETE /api/rbac/permissions`
- `GET|POST|DELETE /api/rbac/assignments`
- `GET|POST|PATCH|DELETE /api/clients`
- `GET|POST|PATCH|DELETE /api/assets`
- `GET|POST|PATCH|DELETE /api/vehicle-profiles`
- `GET|POST|PATCH|DELETE /api/orders`
- `POST /api/orders/workflow`
- `GET|POST|PATCH|DELETE /api/order-tasks`
- `GET|POST|PATCH|DELETE /api/order-assignments`
- `GET|POST|PATCH|DELETE /api/order-status-history`
- `GET|POST|PATCH|DELETE /api/order-approvals`
- `GET|POST|PATCH|DELETE /api/order-financials`
- `GET|POST|PATCH|DELETE /api/inventory-items`
- `GET|POST|PATCH|DELETE /api/inventory-stocks`
- `GET|POST|PATCH|DELETE /api/stock-documents`
- `GET|POST|PATCH|DELETE /api/stock-document-lines`
- `GET|POST|PATCH|DELETE /api/stock-movements`
- `GET|POST|PATCH|DELETE /api/planned-parts`
- `GET|POST|PATCH|DELETE /api/order-task-parts`
- `GET|POST|PATCH|DELETE /api/payment-methods`
- `GET|POST|PATCH|DELETE /api/payments`
- `GET|POST|PATCH|DELETE /api/expense-categories`
- `GET|POST|PATCH|DELETE /api/expenses`
- `GET /api/dashboard/summary?organizationId=...&branchId=...`
- `GET /docs`

## Targeted Workflow Tests

- `src/modules/orders/orders.service.spec.ts`
  - duplicate pending approval create is blocked
  - duplicate pending approval update is blocked
  - order status changes write status history
  - delivery is blocked while unpaid balance remains
  - approved estimate auto-transitions order status
  - rejected approvals require a decision note

- `src/modules/finance/finance.service.spec.ts`
  - cancelled orders cannot receive payments
  - invalid payment dates are rejected early
  - overpayments beyond remaining debt are blocked

## Security Regression Tests

Main API regression suite:

- `test/security.e2e-spec.ts`

Current focus:

- tenant isolation on read and write endpoints
- cross-organization filter validation
- RBAC system-role protection
- cashier payment-only order restrictions
- dashboard scope checks
