# CRM Web Project

Monorepo for the CRM platform.

## Workspace

- `backend` - NestJS + Prisma + PostgreSQL API
- `frontend` - React + Vite client
- `scripts` - local PowerShell helpers
- `.github/workflows/ci.yml` - CI pipeline

## Quick Start

1. Install backend dependencies:

```powershell
npm --prefix backend ci
```

2. Install frontend dependencies:

```powershell
npm --prefix frontend ci
```

3. Follow backend environment and database setup:

- `backend/README.md`

4. Run local development helpers if needed:

```powershell
npm run dev
```

## Verification

Run the same checks that CI uses:

```powershell
npm run verify
```

Useful partial commands:

- `npm run verify:backend`
- `npm run verify:frontend`
- `npm run lint:backend`
- `npm run build:backend`
- `npm run test:backend`
- `npm run test:e2e:backend`
- `npm run lint:frontend`
- `npm run build:frontend`

## CI

GitHub Actions workflow:

- `.github/workflows/ci.yml`
- `GITHUB_SETUP.md`
- `CONTRIBUTING.md`

Backend job runs:

- Prisma client generation
- lint
- build
- unit tests
- e2e security regressions

Frontend job runs:

- lint
- build

## Security Regression Focus

Current regression coverage heavily protects:

- tenant isolation across CRUD and read filters
- RBAC system-role protection
- payment-only order update restrictions
- dashboard scope validation
- cross-organization relation filters by `organizationId`, `orderId`, `branchId`, `clientId`, `stockDocumentId`, and `orderTaskId`

Main API regression suite:

- `backend/test/security.e2e-spec.ts`

## Demo QA

Role-based demo checklist:

- `DEMO_ROLE_QA.md`
- `scripts/demo_role_smoke.ps1`
