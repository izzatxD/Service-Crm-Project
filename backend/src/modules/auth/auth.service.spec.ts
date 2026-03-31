import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StaffAccountAuthMode, StaffRole } from '@prisma/client';

import { hashPassword } from '../../common/utils/bcrypt.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type AuthPrismaMock = {
  organization: { findFirst: jest.Mock };
  staffAccount: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  staffAccountPasswordResetToken: {
    updateMany: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  user: { findFirst: jest.Mock; update: jest.Mock };
  role: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

type TransactionInput =
  | ((tx: AuthPrismaMock) => unknown)
  | Array<Promise<unknown>>;

function createStaffAccountContext(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    staffMemberId: 'staff-1',
    loginIdentifier: 'manager@acme.uz',
    passwordHash: '$2b$10$dummy',
    telegramUserId: '123456789',
    authMode: StaffAccountAuthMode.password_and_telegram,
    isActive: true,
    mustChangePassword: false,
    sessionVersion: 3,
    lastLoginAt: null,
    verifiedAt: new Date('2026-03-20T00:00:00.000Z'),
    deletedAt: null,
    organization: {
      id: 'org-1',
      name: 'Acme Service',
      slug: 'acme-service',
      timezone: 'Asia/Tashkent',
      currencyCode: 'UZS',
      isActive: true,
      deletedAt: null,
      branches: [],
    },
    staffMember: {
      id: 'staff-1',
      organizationId: 'org-1',
      fullName: 'Manager User',
      primaryRole: StaffRole.admin,
      isActive: true,
      deletedAt: null,
      assignedRoles: [
        {
          id: 'assignment-1',
          roleId: 'role-1',
          expiresAt: null,
          role: {
            code: 'custom-manager',
            name: 'Custom Manager',
            rolePermissions: [
              {
                permission: {
                  code: 'task.update',
                },
              },
            ],
          },
        },
      ],
    },
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: AuthPrismaMock;
  let jwtService: { signAsync: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      organization: {
        findFirst: jest.fn(),
      },
      staffAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'account-1' }),
      },
      staffAccountPasswordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'reset-1' }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'reset-1' }),
      },
      user: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({
          rolePermissions: [
            {
              permission: {
                code: 'order.update',
              },
            },
          ],
        }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((operations: TransactionInput) => {
          if (typeof operations === 'function') {
            return operations(prisma);
          }

          return Promise.all(operations);
        }),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    };

    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'app.nodeEnv':
            return 'test';
          case 'app.passwordResetTtlMinutes':
            return 30;
          default:
            return undefined;
        }
      }),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('logs in an organization-scoped staff account', async () => {
    const passwordHash = await hashPassword('Secret123');
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.staffAccount.findFirst.mockResolvedValue(
      createStaffAccountContext({
        passwordHash,
      }),
    );

    const response = await service.login({
      organizationSlug: 'Acme-Service',
      loginIdentifier: 'Manager@Acme.uz',
      password: 'Secret123',
    });

    expect(response).toEqual(
      expect.objectContaining({
        authType: 'staff',
        accessToken: 'signed-token',
        accountId: 'account-1',
        organizationId: 'org-1',
        organizationIds: ['org-1'],
        permissionCodes: ['order.update', 'task.update'],
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        authType: 'staff',
        organizationId: 'org-1',
        staffMemberId: 'staff-1',
      }),
    );
  });

  it('logs in a staff account with login and password only', async () => {
    const passwordHash = await hashPassword('Secret123');
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.staffAccount.findMany.mockResolvedValue([
      createStaffAccountContext({
        passwordHash,
      }),
    ]);

    const response = await service.login({
      loginIdentifier: 'Manager@Acme.uz',
      password: 'Secret123',
    });

    expect(response).toEqual(
      expect.objectContaining({
        authType: 'staff',
        accountId: 'account-1',
        organizationId: 'org-1',
      }),
    );
  });

  it('logs in a platform admin with login and password only', async () => {
    const passwordHash = await hashPassword('PlatformSecret123!');
    const passwordUpdatedAt = new Date('2026-03-30T10:00:00.000Z');
    const profileUpdatedAt = new Date('2026-03-30T11:00:00.000Z');
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'platform-admin@test.local',
      authIdentities: [{ passwordHash, updatedAt: passwordUpdatedAt }],
      platformAdminProfile: {
        isActive: true,
        deletedAt: null,
        updatedAt: profileUpdatedAt,
      },
    });

    const response = await service.login({
      loginIdentifier: 'platform-admin@test.local',
      password: 'PlatformSecret123!',
    });

    expect(response).toEqual(
      expect.objectContaining({
        authType: 'platform_admin',
        userId: 'user-1',
        isPlatformAdmin: true,
        sessionVersion: profileUpdatedAt.getTime(),
      }),
    );
  });

  it('rejects login when one login matches multiple staff accounts', async () => {
    const passwordHash = await hashPassword('Secret123');
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.staffAccount.findMany.mockResolvedValue([
      createStaffAccountContext({
        id: 'account-1',
        passwordHash,
      }),
      createStaffAccountContext({
        id: 'account-2',
        organizationId: 'org-2',
        staffMemberId: 'staff-2',
        organization: {
          id: 'org-2',
          name: 'Other Service',
          slug: 'other-service',
          timezone: 'Asia/Tashkent',
          currencyCode: 'UZS',
          isActive: true,
          deletedAt: null,
          branches: [],
        },
        staffMember: {
          id: 'staff-2',
          organizationId: 'org-2',
          fullName: 'Other Manager',
          primaryRole: StaffRole.manager,
          isActive: true,
          deletedAt: null,
          assignedRoles: [],
        },
        passwordHash,
      }),
    ]);

    await expect(
      service.login({
        loginIdentifier: 'manager@acme.uz',
        password: 'Secret123',
      }),
    ).rejects.toThrow(
      new UnauthorizedException(
        'This login is linked to multiple active accounts. Please contact administrator.',
      ),
    );
  });

  it('rejects login when the organization slug is wrong', async () => {
    prisma.organization.findFirst.mockResolvedValue(null);

    await expect(
      service.login({
        organizationSlug: 'missing-org',
        loginIdentifier: 'manager@acme.uz',
        password: 'Secret123',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Invalid organization credentials.'),
    );
  });

  it('rejects login when password is wrong', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.staffAccount.findFirst.mockResolvedValue(
      createStaffAccountContext({
        passwordHash: await hashPassword('AnotherPass123'),
      }),
    );

    await expect(
      service.login({
        organizationSlug: 'acme-service',
        loginIdentifier: 'manager@acme.uz',
        password: 'Secret123',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Invalid organization credentials.'),
    );
  });

  it('rejects login for a disabled staff account', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.staffAccount.findFirst.mockResolvedValue(
      createStaffAccountContext({
        isActive: false,
      }),
    );

    await expect(
      service.login({
        organizationSlug: 'acme-service',
        loginIdentifier: 'manager@acme.uz',
        password: 'Secret123',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Invalid organization credentials.'),
    );
  });

  it('keeps telegram login scoped to the selected organization', async () => {
    prisma.organization.findFirst
      .mockResolvedValueOnce({ id: 'org-1' })
      .mockResolvedValueOnce({ id: 'org-2' });
    prisma.staffAccount.findFirst
      .mockResolvedValueOnce(createStaffAccountContext())
      .mockResolvedValueOnce(null);

    await expect(
      service.telegramLogin({
        organizationSlug: 'acme-service',
        telegramUserId: '123456789',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
      }),
    );

    await expect(
      service.telegramLogin({
        organizationSlug: 'other-service',
        telegramUserId: '123456789',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Invalid organization credentials.'),
    );
  });

  it('confirms password reset and rotates the session version', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.staffAccountPasswordResetToken.findFirst.mockResolvedValue({
      id: 'reset-1',
      staffAccountId: 'account-1',
      staffAccount: {
        id: 'account-1',
        telegramUserId: null,
        deletedAt: null,
      },
    });

    await service.confirmPasswordReset({
      organizationSlug: 'acme-service',
      token: 'plain-reset-token-value-1234567890',
      newPassword: 'BrandNewPass123',
    });

    const staffAccountUpdateCalls = prisma.staffAccount.update.mock
      .calls as Array<
      [
        {
          where: { id: string };
          data: {
            authMode: StaffAccountAuthMode;
            sessionVersion: { increment: number };
          };
        },
      ]
    >;
    const staffAccountUpdateArgs = staffAccountUpdateCalls[0]?.[0];
    expect(staffAccountUpdateArgs.where).toEqual({
      id: 'account-1',
    });
    expect(staffAccountUpdateArgs.data.authMode).toBe(
      StaffAccountAuthMode.password,
    );
    expect(staffAccountUpdateArgs.data.sessionVersion).toEqual({
      increment: 1,
    });
    expect(prisma.staffAccountPasswordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'reset-1',
        },
      }),
    );
  });

  it('loads permissions from the scoped staff membership during JWT validation', async () => {
    prisma.staffAccount.findFirst.mockResolvedValue(
      createStaffAccountContext(),
    );

    const user = await service.validateJwtPayload({
      sub: 'account-1',
      authType: 'staff',
      accountId: 'account-1',
      organizationId: 'org-1',
      staffMemberId: 'staff-1',
      sessionVersion: 3,
    });

    expect(user).toEqual(
      expect.objectContaining({
        authType: 'staff',
        organizationId: 'org-1',
        organizationIds: ['org-1'],
        staffMemberId: 'staff-1',
        permissionCodes: ['order.update', 'task.update'],
      }),
    );
  });

  it('rejects stale platform admin JWT sessions after credential metadata changes', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'platform-admin@test.local',
      authIdentities: [
        {
          updatedAt: new Date('2026-03-30T10:05:00.000Z'),
        },
      ],
      platformAdminProfile: {
        updatedAt: new Date('2026-03-30T10:10:00.000Z'),
      },
    });

    await expect(
      service.validateJwtPayload({
        sub: 'user-1',
        authType: 'platform_admin',
        userId: 'user-1',
        sessionVersion: new Date('2026-03-30T10:00:00.000Z').getTime(),
      }),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Platform administrator session is no longer valid.',
      ),
    );
  });
});
