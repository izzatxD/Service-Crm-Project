# Frontend

React + TypeScript + Vite client for the CRM platform.

## Stack

- React 19
- React Router 7
- TanStack Query 5
- Vite 8
- ESLint

## Scripts

```powershell
npm run dev
npm run lint
npm run build
```

From the workspace root:

```powershell
npm run verify:frontend
```

## What CI Checks

Frontend CI currently runs:

- `npm run lint`
- `npm run build`

## Notes

- Production build output is written to `dist/`
- Frontend lint is expected to stay green together with backend security regressions
- Demo role checks for UI permissions are documented in `../DEMO_ROLE_QA.md`
- API-level demo smoke script is available at `../scripts/demo_role_smoke.ps1`
