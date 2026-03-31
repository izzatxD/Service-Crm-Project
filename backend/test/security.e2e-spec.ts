import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AccessGuard } from '../src/modules/auth/access.guard';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../src/modules/auth/interfaces/auth-user.interface';
import {
  AssetsController,
  ClientsController,
} from '../src/modules/clients/clients.controller';
import { ClientsService } from '../src/modules/clients/clients.service';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { FinanceController } from '../src/modules/finance/finance.controller';
import { FinanceService } from '../src/modules/finance/finance.service';
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import {
  BranchesController,
  OrganizationsController,
} from '../src/modules/organizations/organizations.controller';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RbacController } from '../src/modules/rbac/rbac.controller';
import { RbacService } from '../src/modules/rbac/rbac.service';
import { StaffController } from '../src/modules/staff/staff.controller';
import { StaffService } from '../src/modules/staff/staff.service';

type TestUserKey =
  | 'manager'
  | 'cashier'
  | 'tenantAdmin'
  | 'inventoryManager'
  | 'reportReader'
  | 'auditor';

type SecurityPrismaMock = {
  organization: {
    findFirst: jest.Mock;
  };
  client: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  asset: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  branch: {
    findFirst: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  staffMember: {
    findFirst: jest.Mock;
  };
  paymentMethodTypeOrg: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  payment: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  inventoryItem: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  stockDocument: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  staffAccount: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  order: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  orderTask: {
    findFirst: jest.Mock;
  };
  orderApproval: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  serviceCategory: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  role: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  rolePermission: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

const TEST_USERS: Record<TestUserKey, AuthenticatedUser> = {
  manager: {
    sub: 'account-manager',
    authType: 'staff',
    accountId: 'account-manager',
    organizationId: 'org-1',
    organizationIds: ['org-1'],
    staffMemberId: 'staff-1',
    loginIdentifier: 'manager@crm.local',
    email: null,
    isPlatformAdmin: false,
    permissionCodes: [
      'order.read',
      'order.create',
      'order.update',
      'order.approve',
      'order.assign',
      'system.settings',
      'staff.manage',
    ],
    sessionVersion: 1,
  },
  cashier: {
    sub: 'account-cashier',
    authType: 'staff',
    accountId: 'account-cashier',
    organizationId: 'org-1',
    organizationIds: ['org-1'],
    staffMemberId: 'staff-2',
    loginIdentifier: 'cashier@crm.local',
    email: null,
    isPlatformAdmin: false,
    permissionCodes: ['payment.create'],
    sessionVersion: 1,
  },
  tenantAdmin: {
    sub: 'account-admin',
    authType: 'staff',
    accountId: 'account-admin',
    organizationId: 'org-1',
    organizationIds: ['org-1'],
    staffMemberId: 'staff-3',
    loginIdentifier: 'admin@crm.local',
    email: null,
    isPlatformAdmin: false,
    permissionCodes: ['system.settings'],
    sessionVersion: 1,
  },
  inventoryManager: {
    sub: 'account-inventory',
    authType: 'staff',
    accountId: 'account-inventory',
    organizationId: 'org-1',
    organizationIds: ['org-1'],
    staffMemberId: 'staff-4',
    loginIdentifier: 'inventory@crm.local',
    email: null,
    isPlatformAdmin: false,
    permissionCodes: ['inventory.adjust'],
    sessionVersion: 1,
  },
  reportReader: {
    sub: 'account-report-reader',
    authType: 'staff',
    accountId: 'account-report-reader',
    organizationId: 'org-1',
    organizationIds: ['org-1'],
    staffMemberId: 'staff-5',
    loginIdentifier: 'reporter@crm.local',
    email: null,
    isPlatformAdmin: false,
    permissionCodes: ['report.read'],
    sessionVersion: 1,
  },
  auditor: {
    sub: 'account-auditor',
    authType: 'staff',
    accountId: 'account-auditor',
    organizationId: 'org-1',
    organizationIds: ['org-1'],
    staffMemberId: 'staff-6',
    loginIdentifier: 'auditor@crm.local',
    email: null,
    isPlatformAdmin: false,
    permissionCodes: [
      'order.read',
      'staff.read',
      'payment.read',
      'inventory.read',
      'report.read',
    ],
    sessionVersion: 1,
  },
};

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();

    const rawUserKey = request.headers['x-test-user'];
    const userKey = Array.isArray(rawUserKey) ? rawUserKey[0] : rawUserKey;

    if (!userKey || !(userKey in TEST_USERS)) {
      return false;
    }

    request.user = TEST_USERS[userKey as TestUserKey];
    return true;
  }
}

function createPrismaMock(): SecurityPrismaMock {
  return {
    organization: {
      findFirst: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    asset: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    staffMember: {
      findFirst: jest.fn(),
    },
    paymentMethodTypeOrg: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    stockDocument: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    staffAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderTask: {
      findFirst: jest.fn(),
    },
    orderApproval: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    serviceCategory: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('Security regressions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: SecurityPrismaMock;

  function getHttpServer(application: INestApplication): App {
    return application.getHttpServer() as App;
  }

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(
      async (
        input:
          | ((client: SecurityPrismaMock) => Promise<unknown>)
          | Array<Promise<unknown>>,
      ) => {
        if (typeof input === 'function') {
          return input(prisma);
        }

        return Promise.all(input);
      },
    );

    const moduleBuilder = Test.createTestingModule({
      controllers: [
        OrganizationsController,
        BranchesController,
        ClientsController,
        AssetsController,
        DashboardController,
        StaffController,
        FinanceController,
        InventoryController,
        OrdersController,
        RbacController,
      ],
      providers: [
        AccessGuard,
        ClientsService,
        DashboardService,
        StaffService,
        FinanceService,
        InventoryService,
        OrganizationsService,
        OrdersService,
        RbacService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtAuthGuard,
          useClass: TestJwtAuthGuard,
        },
      ],
    });

    moduleBuilder.overrideGuard(JwtAuthGuard).useClass(TestJwtAuthGuard);

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('blocks deleting a branch from another organization by id', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .delete('/branches/branch-2')
      .set('x-test-user', 'manager')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks reading an organization from another organization by id', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org-2',
      deletedAt: null,
      branches: [],
    });

    await request(getHttpServer(app))
      .get('/organizations/org-2')
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks reading a branch from another organization by id', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/branches/branch-2')
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks deleting clients from another organization by id', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-2',
      organizationId: 'org-2',
      deletedAt: null,
      assets: [],
    });

    await request(getHttpServer(app))
      .delete('/clients/client-2')
      .set('x-test-user', 'manager')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing clients for another organization via query scope', async () => {
    await request(getHttpServer(app))
      .get('/clients')
      .query({
        organizationId: 'org-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks reading a client from another organization by id', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-2',
      organizationId: 'org-2',
      deletedAt: null,
      assets: [],
    });

    await request(getHttpServer(app))
      .get('/clients/client-2')
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing assets for another organization via client filter', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-2',
      organizationId: 'org-2',
    });

    await request(getHttpServer(app))
      .get('/assets')
      .query({
        clientId: 'client-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks deleting staff members from another organization by id', async () => {
    prisma.staffMember.findFirst.mockResolvedValue({
      id: 'staff-9',
      organizationId: 'org-2',
      deletedAt: null,
      user: null,
      organization: {
        id: 'org-2',
        name: 'Other org',
        slug: 'other-org',
      },
      assignedRoles: [],
      staffAccounts: [],
    });

    await request(getHttpServer(app))
      .delete('/staff/staff-9')
      .set('x-test-user', 'manager')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing staff members for another organization via query scope', async () => {
    await request(getHttpServer(app))
      .get('/staff')
      .query({
        organizationId: 'org-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks reading a staff member from another organization by id', async () => {
    prisma.staffMember.findFirst.mockResolvedValue({
      id: 'staff-9',
      organizationId: 'org-2',
      deletedAt: null,
      user: null,
      organization: {
        id: 'org-2',
        name: 'Other org',
        slug: 'other-org',
      },
      assignedRoles: [],
      staffAccounts: [],
    });

    await request(getHttpServer(app))
      .get('/staff/staff-9')
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks payment-only users from editing restricted order fields', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      assetId: 'asset-1',
      createdByStaffId: 'staff-1',
      assignedManagerId: null,
      status: 'completed',
      closedAt: new Date('2026-03-31T10:00:00.000Z'),
      deliveredAt: null,
      tasks: [],
      assignments: [],
      approvals: [],
      statusHistory: [],
      financial: null,
    });

    await request(getHttpServer(app))
      .patch('/orders/order-1')
      .set('x-test-user', 'cashier')
      .send({
        intakeNotes: 'tampered via cashier',
      })
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'Payment operators can only record settlement updates on an order.',
        );
      });
  });

  it('blocks listing order tasks for another organization via order filter', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/order-tasks')
      .query({
        orderId: 'order-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing order assignments for another organization via order filter', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/order-assignments')
      .query({
        orderId: 'order-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing order status history for another organization via order filter', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/order-status-history')
      .query({
        orderId: 'order-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing order approvals for another organization via order filter', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/order-approvals')
      .query({
        orderId: 'order-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing order financials for another organization via order filter', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/order-financials')
      .query({
        orderId: 'order-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks deleting payment methods from another organization by id', async () => {
    prisma.paymentMethodTypeOrg.findFirst.mockResolvedValue({
      id: 'payment-method-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .delete('/payment-methods/payment-method-2')
      .set('x-test-user', 'manager')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing payment methods for another organization via query scope', async () => {
    await request(getHttpServer(app))
      .get('/payment-methods')
      .query({
        organizationId: 'org-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing payments for another organization via order filter', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/payments')
      .query({
        orderId: 'order-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks deleting payments from another organization by id', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-2',
      organizationId: 'org-2',
      orderId: 'order-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .delete('/payments/payment-2')
      .set('x-test-user', 'cashier')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks deleting inventory items from another organization by id', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue({
      id: 'item-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .delete('/inventory-items/item-2')
      .set('x-test-user', 'inventoryManager')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing stock documents for another organization via query scope', async () => {
    await request(getHttpServer(app))
      .get('/stock-documents')
      .query({
        organizationId: 'org-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing inventory stocks for another organization via branch filter', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/inventory-stocks')
      .query({
        branchId: 'branch-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing stock document lines for another organization via stock document filter', async () => {
    prisma.stockDocument.findFirst.mockResolvedValue({
      id: 'document-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/stock-document-lines')
      .query({
        stockDocumentId: 'document-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing stock movements for another organization via branch filter', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/stock-movements')
      .query({
        branchId: 'branch-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing planned parts for another organization via order task filter', async () => {
    prisma.orderTask.findFirst.mockResolvedValue({
      id: 'task-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/planned-parts')
      .query({
        orderTaskId: 'task-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks listing order task parts for another organization via order task filter', async () => {
    prisma.orderTask.findFirst.mockResolvedValue({
      id: 'task-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/order-task-parts')
      .query({
        orderTaskId: 'task-2',
      })
      .set('x-test-user', 'auditor')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks deleting stock documents from another organization by id', async () => {
    prisma.stockDocument.findFirst.mockResolvedValue({
      id: 'document-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .delete('/stock-documents/document-2')
      .set('x-test-user', 'inventoryManager')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks resetting staff account passwords for another organization by id', async () => {
    prisma.staffMember.findFirst.mockResolvedValue({
      id: 'staff-9',
      organizationId: 'org-2',
      deletedAt: null,
      user: null,
      organization: {
        id: 'org-2',
        name: 'Other org',
        slug: 'other-org',
      },
      assignedRoles: [],
      staffAccounts: [],
    });

    await request(getHttpServer(app))
      .post('/staff/staff-9/account/reset-password')
      .set('x-test-user', 'manager')
      .send({
        newPassword: 'ResetPass123',
        mustChangePassword: true,
      })
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks deleting approvals from another organization by id', async () => {
    prisma.orderApproval.findFirst.mockResolvedValue({
      id: 'approval-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .delete('/order-approvals/approval-2')
      .set('x-test-user', 'manager')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks updating service categories from another organization by id', async () => {
    prisma.serviceCategory.findFirst.mockResolvedValue({
      id: 'category-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .patch('/service-categories/category-2')
      .set('x-test-user', 'manager')
      .send({
        name: 'Tampered name',
      })
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks tenant admins from modifying system roles over the API', async () => {
    prisma.role.findFirst.mockResolvedValue({
      id: 'role-system',
      organizationId: null,
      isSystemRole: true,
      rolePermissions: [],
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .patch('/rbac/roles/role-system')
      .set('x-test-user', 'tenantAdmin')
      .send({
        name: 'Tampered system role',
      })
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'Only platform administrators can modify system roles.',
        );
      });
  });

  it('blocks dashboard summary requests for another organization via query scope', async () => {
    await request(getHttpServer(app))
      .get('/dashboard/summary')
      .query({
        organizationId: 'org-2',
      })
      .set('x-test-user', 'reportReader')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });

  it('blocks dashboard summary requests for another organization via branch scope', async () => {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-2',
      organizationId: 'org-2',
      deletedAt: null,
    });

    await request(getHttpServer(app))
      .get('/dashboard/summary')
      .query({
        organizationId: 'org-1',
        branchId: 'branch-2',
      })
      .set('x-test-user', 'reportReader')
      .expect(403)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'You do not have access to this organization.',
        );
      });
  });
});
