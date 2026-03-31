import { SetMetadata } from '@nestjs/common';

import { REQUIRE_ANY_PERMISSION_KEY } from './auth.constants';

/**
 * Marks a route as requiring AT LEAST ONE of the listed permissions (OR logic).
 * Unlike @RequirePermissions which requires ALL (AND logic).
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, permissions);
