# Organization-Scoped Staff Auth

## Architecture Summary

- `staff_members` remains the operational identity inside each organization.
- New `staff_accounts` now owns staff login state, credentials, session invalidation, and tenant routing.
- Normal staff authentication no longer depends on shared global `users` and `user_auth_identities`.
- Global `users` and `user_auth_identities` are kept only for platform administrators and legacy audit/backfill during phase 1.
- Organization routing is resolved at login via `organizations.slug`, so a session is always bound to exactly one tenant.

## Migration Plan

1. Add `organizations.slug`, `staff_accounts`, and `staff_account_password_reset_tokens`.
2. Make `staff_members.user_id` nullable so new staff can exist without global auth records.
3. Backfill `organizations.slug` for all existing tenants.
4. Backfill one `staff_account` per `staff_member` from `users` and `user_auth_identities`.
5. Switch application auth and JWT validation to load staff accounts directly.
6. Keep legacy global auth tables online for rollback safety and platform admin access.
7. Remove legacy staff-auth dependencies only in phase 2 after production verification.

## API Contract

- `POST /auth/login`
  - Default: `loginIdentifier + password`
- `POST /auth/logout`
  - Stateless acknowledgement for JWT clients.
- `POST /auth/password/reset-request`
  - Requires `organizationSlug + loginIdentifier`.
- `POST /auth/password/reset-confirm`
  - Requires `organizationSlug + token + newPassword`.
- `POST /auth/telegram/login`
  - Requires `organizationSlug + telegramUserId`.
- `GET /auth/me`
  - Returns single-organization staff context, branches, account status, and effective permissions.

## JWT Claims

- Staff JWT: `account_id`, `organization_id`, `staff_member_id`, `session_version`
- Platform admin JWT: `user_id`, `session_version`
- Effective permissions are reloaded from the database on each request instead of being stored in the token.

## Phase 2 Cleanup

- Remove staff-login code paths from `users` and `user_auth_identities`.
- Delete deprecated user-centric staff creation/update flows after all clients move to `staff_accounts`.
- Remove legacy frontend organization switch logic for normal staff users.
- Decide whether legacy profile fields like `phone` should move to `staff_members` or a dedicated profile table.
- Archive or drop legacy auth tables only after backfill verification, production soak time, and rollback windows are closed.
