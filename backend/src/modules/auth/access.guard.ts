import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import {
  PLATFORM_ADMIN_ONLY_KEY,
  REQUIRE_ANY_PERMISSION_KEY,
  REQUIRE_PERMISSIONS_KEY,
} from './auth.constants';
import type { AuthenticatedUser } from './interfaces/auth-user.interface';

type AccessRequest = {
  user?: AuthenticatedUser;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
};

@Injectable()
export class AccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AccessRequest>();
    const { user } = request;

    if (!user) {
      return false;
    }

    const handler = context.getHandler();
    const targetClass = context.getClass();

    const platformAdminOnly =
      this.readMetadata<boolean>(
        handler,
        targetClass,
        PLATFORM_ADMIN_ONLY_KEY,
      ) ?? false;

    // AND logic — all permissions must be present
    const requiredPermissions =
      this.readMetadata<string[]>(
        handler,
        targetClass,
        REQUIRE_PERMISSIONS_KEY,
      ) ?? [];

    // OR logic — at least one permission must be present
    const anyPermissions =
      this.readMetadata<string[]>(
        handler,
        targetClass,
        REQUIRE_ANY_PERMISSION_KEY,
      ) ?? [];

    if (platformAdminOnly && !user.isPlatformAdmin) {
      throw new ForbiddenException(
        'This action is only available to platform administrators.',
      );
    }

    if (user.isPlatformAdmin) {
      return true;
    }

    if (requiredPermissions.length) {
      const hasAllPermissions = requiredPermissions.every((permissionCode) =>
        user.permissionCodes.includes(permissionCode),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException(
          'You do not have permission to perform this action.',
        );
      }
    }

    if (anyPermissions.length) {
      const hasAnyPermission = anyPermissions.some((permissionCode) =>
        user.permissionCodes.includes(permissionCode),
      );

      if (!hasAnyPermission) {
        throw new ForbiddenException(
          'You do not have permission to perform this action.',
        );
      }
    }

    const organizationId = this.extractOrganizationId(request);
    if (organizationId && !user.organizationIds.includes(organizationId)) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }

    return true;
  }

  private extractOrganizationId(request: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
  }): string | undefined {
    const candidates = [
      request.body?.organizationId,
      request.query?.organizationId,
      request.params?.organizationId,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }

    return undefined;
  }

  private readMetadata<T>(
    handler: object,
    targetClass: object,
    key: string,
  ): T | undefined {
    const handlerMetadata = Reflect.getMetadata(key, handler) as T | undefined;
    if (handlerMetadata !== undefined) {
      return handlerMetadata;
    }

    return Reflect.getMetadata(key, targetClass) as T | undefined;
  }
}
