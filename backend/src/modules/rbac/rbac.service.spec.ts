import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  let service: RbacService;
  let prisma: {
    role: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    rolePermission: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    staffMember: {
      findFirst: jest.Mock;
    };
    staffMemberRole: {
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      role: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      rolePermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      staffMember: {
        findFirst: jest.fn(),
      },
      staffMemberRole: {
        create: jest.fn(),
      },
    };

    service = new RbacService(prisma as unknown as PrismaService);
  });

  it('blocks tenant admins from modifying system roles', async () => {
    prisma.role.findFirst.mockResolvedValue({
      id: 'role-1',
      organizationId: null,
      isSystemRole: true,
      rolePermissions: [],
    });

    await expect(
      service.updateRole(
        'role-1',
        { name: 'Tampered role' },
        {
          sub: 'account-1',
          authType: 'staff',
          accountId: 'account-1',
          organizationId: 'org-1',
          isPlatformAdmin: false,
          organizationIds: ['org-1'],
          staffMemberId: 'staff-1',
          loginIdentifier: 'admin@crm.local',
          permissionCodes: ['system.settings'],
          sessionVersion: 1,
        },
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Only platform administrators can modify system roles.',
      ),
    );
  });

  it('rejects assigning an organization role from another organization', async () => {
    prisma.staffMember.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.role.findFirst.mockResolvedValue({
      id: 'role-2',
      organizationId: 'org-2',
      isSystemRole: false,
    });

    await expect(
      service.assignRole({
        organizationId: 'org-1',
        staffMemberId: 'staff-1',
        roleId: 'role-2',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Role does not belong to the selected organization.',
      ),
    );
  });
});
