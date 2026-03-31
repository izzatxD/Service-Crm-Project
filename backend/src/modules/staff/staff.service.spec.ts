import { ForbiddenException } from '@nestjs/common';
import { StaffRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StaffService } from './staff.service';

function createStaffMemberRecord() {
  return {
    id: 'staff-1',
    organizationId: 'org-1',
    userId: null,
    fullName: 'Staff User',
    primaryRole: StaffRole.worker,
    isActive: true,
    hiredAt: null,
    createdAt: new Date('2026-03-20T00:00:00.000Z'),
    updatedAt: new Date('2026-03-20T00:00:00.000Z'),
    deletedAt: null,
    user: null,
    organization: {
      id: 'org-1',
      name: 'Acme Service',
      slug: 'acme-service',
    },
    assignedRoles: [],
    staffAccounts: [
      {
        id: 'account-1',
        organizationId: 'org-1',
        staffMemberId: 'staff-1',
        loginIdentifier: 'worker@acme.uz',
        telegramUserId: null,
        authMode: 'password',
        isActive: true,
        mustChangePassword: false,
        sessionVersion: 1,
        lastLoginAt: null,
        verifiedAt: null,
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
        updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        deletedAt: null,
      },
    ],
  };
}

describe('StaffService', () => {
  let service: StaffService;
  let prisma: {
    staffMember: { findFirst: jest.Mock; update: jest.Mock };
    staffAccount: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      staffMember: {
        findFirst: jest.fn().mockResolvedValue(createStaffMemberRecord()),
        update: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      staffAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'account-1',
          loginIdentifier: 'worker@acme.uz',
          passwordHash: 'hash',
          telegramUserId: null,
          authMode: 'password',
          isActive: true,
          mustChangePassword: false,
          verifiedAt: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'account-1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (client: typeof prisma) => unknown) =>
          callback(prisma),
        ),
    };

    service = new StaffService(prisma as unknown as PrismaService);
  });

  it('soft-deletes the staff member and current staff account together', async () => {
    const result = await service.remove('staff-1');

    const staffUpdateCalls = prisma.staffMember.update.mock.calls as Array<
      [
        {
          where: { id: string };
          data: { isActive: boolean };
        },
      ]
    >;
    const staffUpdateArgs = staffUpdateCalls[0]?.[0];
    expect(staffUpdateArgs.where).toEqual({ id: 'staff-1' });
    expect(staffUpdateArgs.data).toEqual(
      expect.objectContaining({
        isActive: false,
      }),
    );
    const accountUpdateCalls = prisma.staffAccount.update.mock.calls as Array<
      [
        {
          where: { id: string };
          data: { isActive: boolean };
        },
      ]
    >;
    const accountUpdateArgs = accountUpdateCalls[0]?.[0];
    expect(accountUpdateArgs.where).toEqual({ id: 'account-1' });
    expect(accountUpdateArgs.data).toEqual(
      expect.objectContaining({
        isActive: false,
      }),
    );
    expect(result).toEqual({
      success: true,
      staffMemberId: 'staff-1',
    });
  });

  it('rejects deleting staff from another organization', async () => {
    await expect(
      service.remove('staff-1', {
        sub: 'account-2',
        authType: 'staff',
        accountId: 'account-2',
        organizationId: 'org-2',
        isPlatformAdmin: false,
        organizationIds: ['org-2'],
        staffMemberId: 'staff-2',
        loginIdentifier: 'manager@other.uz',
        permissionCodes: ['staff.manage'],
        sessionVersion: 1,
      }),
    ).rejects.toThrow(
      new ForbiddenException('You do not have access to this organization.'),
    );
  });
});
