export type AuthenticatedUserType = 'staff' | 'platform_admin';

export interface JwtTokenPayload {
  sub: string;
  authType: AuthenticatedUserType;
  accountId?: string;
  userId?: string;
  organizationId?: string;
  staffMemberId?: string;
  sessionVersion: number;
}

export interface AuthenticatedUser {
  sub: string;
  authType: AuthenticatedUserType;
  accountId?: string;
  userId?: string;
  email?: string | null;
  loginIdentifier?: string | null;
  isPlatformAdmin: boolean;
  organizationId?: string;
  organizationIds: string[];
  staffMemberId?: string;
  permissionCodes: string[];
  sessionVersion: number;
}
