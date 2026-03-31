# Contributing

## Workflow

1. Create a branch from `main`
2. Make your changes
3. Run local verification
4. Open a pull request
5. Wait for CI and review before merge

## Local Verification

Run the full project check:

```powershell
npm run verify
```

Useful partial checks:

- `npm run verify:backend`
- `npm run verify:frontend`

## Security Rule

If your change touches any of these areas, update or add regression coverage:

- auth
- permissions
- tenant isolation
- dashboard scope
- role assignment
- order/payment restrictions

Main backend regression suite:

- `backend/test/security.e2e-spec.ts`

## Manual QA

Run manual smoke checks when UI, workflow, or permissions change:

- login flow
- dashboard
- orders
- payments
- inventory
- role-based access with demo accounts

Checklist:

- `DEMO_ROLE_QA.md`

## Pull Requests

Every PR should include:

- short summary
- reason for the change
- risk or rollout notes
- verification notes

Use the PR template:

- `.github/pull_request_template.md`
