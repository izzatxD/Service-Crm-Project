import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, StaffAccountAuthMode } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { comparePassword, hashPassword } from '../../common/utils/bcrypt.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import type {
  AuthenticatedUser,
  JwtTokenPayload,
} from './interfaces/auth-user.interface';

const staffAccountAuthInclude = {
  organization: {
    include: {
      branches: {
        where: {
          deletedAt: null,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  },
  staffMember: {
    include: {
      assignedRoles: {
        where: {
          deletedAt: null,
          role: {
            is: {
              deletedAt: null,
              isActive: true,
            },
          },
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.StaffAccountInclude;

type StaffAccountAuthContext = Prisma.StaffAccountGetPayload<{
  include: typeof staffAccountAuthInclude;
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(payload: LoginDto): Promise<AuthResponseDto> {
    const organizationSlug = this.normalizeOrganizationSlug(
      payload.organizationSlug,
    );

    if (organizationSlug) {
      return this.loginStaff(organizationSlug, payload);
    }

    const loginIdentifier = this.requireLoginIdentifier(
      payload.loginIdentifier ?? payload.email,
    );

    const platformAdminSession = await this.tryLoginPlatformAdministrator(
      loginIdentifier,
      payload.password,
    );

    if (platformAdminSession) {
      return platformAdminSession;
    }

    return this.loginStaffWithoutOrganization(
      loginIdentifier,
      payload.password,
    );
  }

  logout() {
    return {
      success: true,
    };
  }

  async requestPasswordReset(payload: PasswordResetRequestDto) {
    const organizationSlug = this.requireOrganizationSlug(
      payload.organizationSlug,
    );
    const loginIdentifier = this.requireLoginIdentifier(
      payload.loginIdentifier ?? payload.email,
    );

    const organization = await this.prisma.organization.findFirst({
      where: {
        slug: organizationSlug,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      return this.buildPasswordResetRequestResponse();
    }

    const staffAccount = await this.prisma.staffAccount.findFirst({
      where: {
        organizationId: organization.id,
        loginIdentifier,
        deletedAt: null,
        isActive: true,
        staffMember: {
          is: {
            deletedAt: null,
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!staffAccount?.passwordHash) {
      return this.buildPasswordResetRequestResponse();
    }

    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashOpaqueToken(resetToken);
    const expiresAt = new Date(
      Date.now() + this.getPasswordResetTtlMinutes() * 60 * 1000,
    );
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.staffAccountPasswordResetToken.updateMany({
        where: {
          organizationId: organization.id,
          staffAccountId: staffAccount.id,
          usedAt: null,
          deletedAt: null,
        },
        data: {
          deletedAt: now,
        },
      }),
      this.prisma.staffAccountPasswordResetToken.create({
        data: {
          organizationId: organization.id,
          staffAccountId: staffAccount.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    return this.buildPasswordResetRequestResponse(resetToken);
  }

  async confirmPasswordReset(payload: PasswordResetConfirmDto) {
    const organizationSlug = this.requireOrganizationSlug(
      payload.organizationSlug,
    );
    const organization = await this.prisma.organization.findFirst({
      where: {
        slug: organizationSlug,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new UnauthorizedException('Reset token is invalid or expired.');
    }

    const resetToken =
      await this.prisma.staffAccountPasswordResetToken.findFirst({
        where: {
          organizationId: organization.id,
          tokenHash: this.hashOpaqueToken(payload.token),
          usedAt: null,
          deletedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          staffAccount: true,
        },
      });

    if (!resetToken || resetToken.staffAccount.deletedAt) {
      throw new UnauthorizedException('Reset token is invalid or expired.');
    }

    const passwordHash = await hashPassword(payload.newPassword);
    const nextAuthMode = resetToken.staffAccount.telegramUserId
      ? StaffAccountAuthMode.password_and_telegram
      : StaffAccountAuthMode.password;

    await this.prisma.$transaction([
      this.prisma.staffAccount.update({
        where: {
          id: resetToken.staffAccountId,
        },
        data: {
          passwordHash,
          authMode: nextAuthMode,
          mustChangePassword: false,
          verifiedAt: new Date(),
          sessionVersion: {
            increment: 1,
          },
        },
      }),
      this.prisma.staffAccountPasswordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: 'Password reset completed successfully.',
    };
  }

  async telegramLogin(payload: TelegramLoginDto): Promise<AuthResponseDto> {
    const organizationSlug = this.requireOrganizationSlug(
      payload.organizationSlug,
    );
    const telegramUserId = payload.telegramUserId.trim();

    if (!telegramUserId) {
      throw new BadRequestException('telegramUserId is required.');
    }

    const organization = await this.prisma.organization.findFirst({
      where: {
        slug: organizationSlug,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new UnauthorizedException('Invalid organization credentials.');
    }

    const staffAccount = await this.prisma.staffAccount.findFirst({
      where: {
        organizationId: organization.id,
        telegramUserId,
        deletedAt: null,
      },
      include: staffAccountAuthInclude,
    });

    return this.issueStaffAuthResponse(
      this.requireAuthenticatableStaffAccount(
        staffAccount,
        'Invalid organization credentials.',
      ),
    );
  }

  async getMe(user: AuthenticatedUser) {
    if (user.isPlatformAdmin) {
      return this.getPlatformAdministratorMe(user.userId ?? user.sub);
    }

    const staffAccount = await this.getActiveStaffAccountOrThrow({
      accountId: user.accountId ?? user.sub,
      organizationId: user.organizationId,
      staffMemberId: user.staffMemberId,
      sessionVersion: user.sessionVersion,
    });

    const permissionCodes = await this.collectPermissionCodes(
      staffAccount.staffMember,
    );

    return {
      authType: 'staff' as const,
      isPlatformAdmin: false,
      account: {
        id: staffAccount.id,
        loginIdentifier: staffAccount.loginIdentifier,
        telegramUserId: staffAccount.telegramUserId,
        authMode: staffAccount.authMode,
        isActive: staffAccount.isActive,
        mustChangePassword: staffAccount.mustChangePassword,
        lastLoginAt: staffAccount.lastLoginAt,
        verifiedAt: staffAccount.verifiedAt,
        sessionVersion: staffAccount.sessionVersion,
      },
      organization: {
        id: staffAccount.organization.id,
        name: staffAccount.organization.name,
        slug: staffAccount.organization.slug,
        timezone: staffAccount.organization.timezone,
        currencyCode: staffAccount.organization.currencyCode,
      },
      branchAccess: {
        mode: 'all' as const,
        branches: staffAccount.organization.branches,
      },
      staffMember: {
        id: staffAccount.staffMember.id,
        fullName: staffAccount.staffMember.fullName,
        primaryRole: staffAccount.staffMember.primaryRole,
        isActive: staffAccount.staffMember.isActive,
        organizationId: staffAccount.staffMember.organizationId,
        assignedRoles: staffAccount.staffMember.assignedRoles.map(
          (assignment) => ({
            id: assignment.id,
            roleId: assignment.roleId,
            roleCode: assignment.role.code,
            roleName: assignment.role.name,
            expiresAt: assignment.expiresAt,
          }),
        ),
      },
      staffMembers: [
        {
          id: staffAccount.staffMember.id,
          fullName: staffAccount.staffMember.fullName,
          primaryRole: staffAccount.staffMember.primaryRole,
          organizationId: staffAccount.staffMember.organizationId,
        },
      ],
      organizationIds: [staffAccount.organizationId],
      permissionCodes,
    };
  }

  async validateJwtPayload(
    payload: JwtTokenPayload,
  ): Promise<AuthenticatedUser> {
    if (payload.authType === 'platform_admin') {
      return this.validatePlatformAdministratorJwt(payload);
    }

    if (payload.authType !== 'staff') {
      throw new UnauthorizedException('Token type is invalid.');
    }

    const staffAccount = await this.getActiveStaffAccountOrThrow({
      accountId: payload.accountId ?? payload.sub,
      organizationId: payload.organizationId,
      staffMemberId: payload.staffMemberId,
      sessionVersion: payload.sessionVersion,
    });

    const permissionCodes = await this.collectPermissionCodes(
      staffAccount.staffMember,
    );

    return {
      sub: staffAccount.id,
      authType: 'staff',
      accountId: staffAccount.id,
      organizationId: staffAccount.organizationId,
      organizationIds: [staffAccount.organizationId],
      staffMemberId: staffAccount.staffMemberId,
      loginIdentifier: staffAccount.loginIdentifier,
      email: null,
      isPlatformAdmin: false,
      permissionCodes,
      sessionVersion: staffAccount.sessionVersion,
    };
  }

  private async loginStaff(
    organizationSlug: string,
    payload: LoginDto,
  ): Promise<AuthResponseDto> {
    const loginIdentifier = this.requireLoginIdentifier(
      payload.loginIdentifier ?? payload.email,
    );

    const organization = await this.prisma.organization.findFirst({
      where: {
        slug: organizationSlug,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new UnauthorizedException('Invalid organization credentials.');
    }

    const staffAccount = await this.prisma.staffAccount.findFirst({
      where: {
        organizationId: organization.id,
        loginIdentifier,
        deletedAt: null,
      },
      include: staffAccountAuthInclude,
    });

    const activeStaffAccount = this.requireAuthenticatableStaffAccount(
      staffAccount,
      'Invalid organization credentials.',
    );

    if (!activeStaffAccount.passwordHash) {
      throw new UnauthorizedException(
        'This account does not have password login enabled.',
      );
    }

    const isPasswordValid = await comparePassword(
      payload.password,
      activeStaffAccount.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid organization credentials.');
    }

    return this.issueStaffAuthResponse(activeStaffAccount);
  }

  private async tryLoginPlatformAdministrator(
    loginIdentifier: string,
    password: string,
  ): Promise<AuthResponseDto | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginIdentifier,
        deletedAt: null,
        isActive: true,
      },
      include: {
        authIdentities: {
          where: {
            provider: 'password',
            deletedAt: null,
          },
          orderBy: {
            isPrimary: 'desc',
          },
          take: 1,
        },
        platformAdminProfile: true,
      },
    });

    if (
      !user ||
      user.authIdentities.length === 0 ||
      !user.platformAdminProfile ||
      !user.platformAdminProfile.isActive ||
      user.platformAdminProfile.deletedAt
    ) {
      return null;
    }

    const identity = user.authIdentities[0];
    const isPasswordValid = await comparePassword(
      password,
      identity.passwordHash,
    );

    if (!isPasswordValid) {
      return null;
    }

    const sessionVersion = this.buildPlatformAdministratorSessionVersion({
      passwordIdentityUpdatedAt: identity.updatedAt,
      platformAdminProfileUpdatedAt: user.platformAdminProfile.updatedAt,
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      authType: 'platform_admin',
      userId: user.id,
      sessionVersion,
    } satisfies JwtTokenPayload);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken,
      authType: 'platform_admin',
      userId: user.id,
      accountId: null,
      staffMemberId: null,
      organizationId: null,
      organizationSlug: null,
      email: user.email,
      loginIdentifier: user.email,
      isPlatformAdmin: true,
      sessionVersion,
      mustChangePassword: false,
      organizationIds: [],
      permissionCodes: [],
    };
  }

  private async loginStaffWithoutOrganization(
    loginIdentifier: string,
    password: string,
  ): Promise<AuthResponseDto> {
    const matchingAccounts = await this.prisma.staffAccount.findMany({
      where: {
        loginIdentifier,
        deletedAt: null,
      },
      include: staffAccountAuthInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const matchingAuthenticatableAccounts: StaffAccountAuthContext[] = [];

    for (const staffAccount of matchingAccounts) {
      if (!this.isAuthenticatableStaffAccount(staffAccount)) {
        continue;
      }

      if (!staffAccount.passwordHash) {
        continue;
      }

      const isPasswordValid = await comparePassword(
        password,
        staffAccount.passwordHash,
      );

      if (isPasswordValid) {
        matchingAuthenticatableAccounts.push(staffAccount);
      }
    }

    if (matchingAuthenticatableAccounts.length === 1) {
      return this.issueStaffAuthResponse(matchingAuthenticatableAccounts[0]);
    }

    if (matchingAuthenticatableAccounts.length > 1) {
      throw new UnauthorizedException(
        'This login is linked to multiple active accounts. Please contact administrator.',
      );
    }

    throw new UnauthorizedException('Invalid credentials.');
  }

  private async issueStaffAuthResponse(
    staffAccount: StaffAccountAuthContext,
  ): Promise<AuthResponseDto> {
    const permissionCodes = await this.collectPermissionCodes(
      staffAccount.staffMember,
    );
    const accessToken = await this.jwtService.signAsync({
      sub: staffAccount.id,
      authType: 'staff',
      accountId: staffAccount.id,
      organizationId: staffAccount.organizationId,
      staffMemberId: staffAccount.staffMemberId,
      sessionVersion: staffAccount.sessionVersion,
    } satisfies JwtTokenPayload);

    await this.prisma.staffAccount.update({
      where: {
        id: staffAccount.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken,
      authType: 'staff',
      userId: null,
      accountId: staffAccount.id,
      staffMemberId: staffAccount.staffMemberId,
      organizationId: staffAccount.organizationId,
      organizationSlug: staffAccount.organization.slug,
      email: null,
      loginIdentifier: staffAccount.loginIdentifier,
      isPlatformAdmin: false,
      sessionVersion: staffAccount.sessionVersion,
      mustChangePassword: staffAccount.mustChangePassword,
      organizationIds: [staffAccount.organizationId],
      permissionCodes,
    };
  }

  private async validatePlatformAdministratorJwt(
    payload: JwtTokenPayload,
  ): Promise<AuthenticatedUser> {
    const userId = payload.userId ?? payload.sub;
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
        platformAdminProfile: {
          is: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        email: true,
        authIdentities: {
          where: {
            provider: 'password',
            deletedAt: null,
          },
          orderBy: {
            isPrimary: 'desc',
          },
          take: 1,
          select: {
            updatedAt: true,
          },
        },
        platformAdminProfile: {
          select: {
            updatedAt: true,
          },
        },
      },
    });

    if (!user?.platformAdminProfile || user.authIdentities.length === 0) {
      throw new UnauthorizedException(
        'Platform administrator account is invalid.',
      );
    }

    const sessionVersion = this.buildPlatformAdministratorSessionVersion({
      passwordIdentityUpdatedAt: user.authIdentities[0].updatedAt,
      platformAdminProfileUpdatedAt: user.platformAdminProfile.updatedAt,
    });

    if (payload.sessionVersion !== sessionVersion) {
      throw new UnauthorizedException(
        'Platform administrator session is no longer valid.',
      );
    }

    return {
      sub: user.id,
      authType: 'platform_admin',
      userId: user.id,
      email: user.email,
      isPlatformAdmin: true,
      organizationIds: [],
      permissionCodes: [],
      sessionVersion,
    };
  }

  private async getPlatformAdministratorMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        platformAdminProfile: {
          select: {
            roleCode: true,
            isActive: true,
            canManageOrganizations: true,
            canManageAuth: true,
            canImpersonateUsers: true,
          },
        },
      },
    });

    if (!user?.platformAdminProfile) {
      throw new UnauthorizedException(
        'Platform administrator account is invalid.',
      );
    }

    return {
      authType: 'platform_admin' as const,
      isPlatformAdmin: true,
      account: null,
      organization: null,
      branchAccess: {
        mode: 'platform' as const,
        branches: [],
      },
      staffMember: null,
      staffMembers: [],
      organizationIds: [],
      permissionCodes: [],
      platformAdmin: user,
    };
  }

  private async getActiveStaffAccountOrThrow(options: {
    accountId?: string;
    organizationId?: string;
    staffMemberId?: string;
    sessionVersion: number;
  }): Promise<StaffAccountAuthContext> {
    if (
      !options.accountId ||
      !options.organizationId ||
      !options.staffMemberId
    ) {
      throw new UnauthorizedException('Staff token is incomplete.');
    }

    const staffAccount = await this.prisma.staffAccount.findFirst({
      where: {
        id: options.accountId,
        organizationId: options.organizationId,
        staffMemberId: options.staffMemberId,
        deletedAt: null,
      },
      include: staffAccountAuthInclude,
    });

    const activeStaffAccount = this.requireAuthenticatableStaffAccount(
      staffAccount,
      'Staff account is invalid or disabled.',
    );

    if (activeStaffAccount.sessionVersion !== options.sessionVersion) {
      throw new UnauthorizedException('Staff session is no longer valid.');
    }

    return activeStaffAccount;
  }

  private isAuthenticatableStaffAccount(
    staffAccount: StaffAccountAuthContext | null,
  ) {
    return Boolean(
      staffAccount &&
      !staffAccount.deletedAt &&
      staffAccount.isActive &&
      staffAccount.organization.deletedAt === null &&
      staffAccount.organization.isActive &&
      staffAccount.staffMember.deletedAt === null &&
      staffAccount.staffMember.isActive,
    );
  }

  private requireAuthenticatableStaffAccount(
    staffAccount: StaffAccountAuthContext | null,
    message: string,
  ): StaffAccountAuthContext {
    if (!this.isAuthenticatableStaffAccount(staffAccount)) {
      throw new UnauthorizedException(message);
    }

    return staffAccount as StaffAccountAuthContext;
  }

  private async collectPermissionCodes(staffMember: {
    primaryRole: string;
    assignedRoles: Array<{
      expiresAt: Date | null;
      role: {
        rolePermissions: Array<{
          permission: {
            code: string;
          };
        }>;
      };
    }>;
  }) {
    const permissionCodes = new Set<string>();
    const primaryRole = await this.prisma.role.findFirst({
      where: {
        code: staffMember.primaryRole,
        isSystemRole: true,
        organizationId: null,
        deletedAt: null,
        isActive: true,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    primaryRole?.rolePermissions.forEach((rolePermission) => {
      permissionCodes.add(rolePermission.permission.code);
    });

    const now = new Date();

    staffMember.assignedRoles.forEach((assignedRole) => {
      if (assignedRole.expiresAt && assignedRole.expiresAt <= now) {
        return;
      }

      assignedRole.role.rolePermissions.forEach((rolePermission) => {
        permissionCodes.add(rolePermission.permission.code);
      });
    });

    return [...permissionCodes].sort();
  }

  private buildPasswordResetRequestResponse(resetToken?: string) {
    const isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';

    return {
      success: true,
      message:
        'If the organization account exists, a password reset token has been issued.',
      ...(isProduction || !resetToken ? {} : { resetToken }),
    };
  }

  private getPasswordResetTtlMinutes() {
    const configuredValue = this.configService.get<number>(
      'app.passwordResetTtlMinutes',
    );

    return configuredValue && configuredValue > 0 ? configuredValue : 30;
  }

  private hashOpaqueToken(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private requireOrganizationSlug(value?: string | null) {
    const normalizedValue = this.normalizeOrganizationSlug(value);

    if (!normalizedValue) {
      throw new BadRequestException('organizationSlug is required.');
    }

    return normalizedValue;
  }

  private requireLoginIdentifier(value?: string | null) {
    const normalizedValue = this.normalizeLoginIdentifier(value);

    if (!normalizedValue) {
      throw new BadRequestException('loginIdentifier is required.');
    }

    return normalizedValue;
  }

  private normalizeOrganizationSlug(value?: string | null) {
    return value?.trim().toLowerCase() || undefined;
  }

  private normalizeLoginIdentifier(value?: string | null) {
    return value?.trim().toLowerCase() || undefined;
  }

  private buildPlatformAdministratorSessionVersion(params: {
    passwordIdentityUpdatedAt: Date;
    platformAdminProfileUpdatedAt: Date;
  }) {
    return Math.max(
      params.passwordIdentityUpdatedAt.getTime(),
      params.platformAdminProfileUpdatedAt.getTime(),
    );
  }
}
