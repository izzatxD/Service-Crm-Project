import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: {
    organization: { findFirst: jest.Mock };
    branch: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findFirst: jest.fn(),
      },
      branch: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new OrganizationsService(prisma as unknown as PrismaService);
  });

  it('blocks creating a branch in another organization', async () => {
    await expect(
      service.createBranch(
        {
          organizationId: 'org-2',
          name: 'Remote branch',
        },
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
      new ForbiddenException('You do not have access to this organization.'),
    );
  });

  it('rejects changing branch organization during update', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
    });

    await expect(
      service.updateBranch(
        'branch-1',
        {
          organizationId: 'org-2',
        },
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
      new BadRequestException(
        'Changing organization of an existing branch is not supported. Create a new branch in the target organization instead.',
      ),
    );
  });
});
