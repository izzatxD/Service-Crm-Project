import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, OrderStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  createBaseOrdersPrismaMock,
  createPendingApprovalRecord,
} from '../../test-utils/workflow-test-mocks';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: { findFirst: jest.Mock };
    orderTask: { count: jest.Mock };
    orderFinancial: { findFirst: jest.Mock };
    staffMember: { findFirst: jest.Mock };
    orderApproval: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = createBaseOrdersPrismaMock();

    service = new OrdersService(prisma as unknown as PrismaService);
  });

  it('rejects duplicate pending approval of the same type for one order', async () => {
    await expect(
      service.createApproval({
        organizationId: 'org-1',
        orderId: 'order-1',
        requestedByStaffId: 'staff-1',
        status: ApprovalStatus.pending,
        approvalTypeCode: 'estimate',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'This order already has a pending approval of the same type.',
      ),
    );
  });

  it('writes status history when order status changes', async () => {
    const tx = {
      order: {
        update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
      staffMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
    };

    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const currentOrder = {
      id: 'order-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      assetId: 'asset-1',
      createdByStaffId: 'staff-1',
      assignedManagerId: null,
      status: OrderStatus.in_progress,
      closedAt: null,
      deliveredAt: null,
    };

    jest
      .spyOn(service, 'findOrderById')
      .mockResolvedValueOnce(currentOrder as never)
      .mockResolvedValueOnce({
        ...currentOrder,
        status: OrderStatus.completed,
      } as never);

    await service.updateOrder(
      'order-1',
      { status: OrderStatus.completed },
      {
        sub: 'account-1',
        authType: 'staff',
        accountId: 'account-1',
        organizationId: 'org-1',
        isPlatformAdmin: false,
        organizationIds: ['org-1'],
        staffMemberId: 'staff-1',
        loginIdentifier: 'manager@crm.local',
        permissionCodes: ['order.update'],
        sessionVersion: 1,
      },
    );

    expect(tx.order.update).toHaveBeenCalled();
    const historyCreateCalls = tx.orderStatusHistory.create.mock.calls as Array<
      [
        {
          data: {
            orderId: string;
            fromStatus: OrderStatus;
            toStatus: OrderStatus;
            changedByStaffId: string;
            note: string;
          };
        },
      ]
    >;
    const historyCreateArgs = historyCreateCalls[0]?.[0];
    expect(historyCreateArgs.data).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        fromStatus: OrderStatus.in_progress,
        toStatus: OrderStatus.completed,
        changedByStaffId: 'staff-1',
        note: 'Order status updated',
      }),
    );
  });

  it('rejects delivering an order when unpaid balance remains', async () => {
    const currentOrder = {
      id: 'order-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      assetId: 'asset-1',
      createdByStaffId: 'staff-1',
      assignedManagerId: null,
      status: OrderStatus.completed,
      closedAt: new Date(),
      deliveredAt: null,
    };

    jest
      .spyOn(service, 'findOrderById')
      .mockResolvedValue(currentOrder as never);
    prisma.order.findFirst.mockResolvedValue(currentOrder);

    await expect(
      service.updateOrder('order-1', { status: OrderStatus.delivered }),
    ).rejects.toThrow(
      new BadRequestException(
        'Order cannot be delivered while there is an unpaid balance.',
      ),
    );
  });

  it('blocks payment-only users from editing non-payment order fields', async () => {
    const currentOrder = {
      id: 'order-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      assetId: 'asset-1',
      createdByStaffId: 'staff-1',
      assignedManagerId: null,
      status: OrderStatus.completed,
      closedAt: new Date(),
      deliveredAt: null,
    };

    jest
      .spyOn(service, 'findOrderById')
      .mockResolvedValue(currentOrder as never);

    await expect(
      service.updateOrder(
        'order-1',
        {
          intakeNotes: 'tampered',
        },
        {
          sub: 'account-1',
          authType: 'staff',
          accountId: 'account-1',
          organizationId: 'org-1',
          isPlatformAdmin: false,
          organizationIds: ['org-1'],
          staffMemberId: 'staff-1',
          loginIdentifier: 'cashier@crm.local',
          permissionCodes: ['payment.create'],
          sessionVersion: 1,
        },
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Payment operators can only record settlement updates on an order.',
      ),
    );
  });

  it('blocks creating service categories in another organization', async () => {
    await expect(
      service.createServiceCategory(
        {
          organizationId: 'org-2',
          name: 'Diagnostics',
        },
        {
          sub: 'account-1',
          authType: 'staff',
          accountId: 'account-1',
          organizationId: 'org-1',
          isPlatformAdmin: false,
          organizationIds: ['org-1'],
          staffMemberId: 'staff-1',
          loginIdentifier: 'manager@crm.local',
          permissionCodes: ['order.create'],
          sessionVersion: 1,
        },
      ),
    ).rejects.toThrow(
      new ForbiddenException('You do not have access to this organization.'),
    );
  });

  it('blocks removing approvals from another organization', async () => {
    prisma.orderApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      organizationId: 'org-2',
    });

    await expect(
      service.removeApproval('approval-1', {
        sub: 'account-1',
        authType: 'staff',
        accountId: 'account-1',
        organizationId: 'org-1',
        isPlatformAdmin: false,
        organizationIds: ['org-1'],
        staffMemberId: 'staff-1',
        loginIdentifier: 'approver@crm.local',
        permissionCodes: ['order.approve'],
        sessionVersion: 1,
      }),
    ).rejects.toThrow(
      new ForbiddenException('You do not have access to this organization.'),
    );
  });

  it('rejects duplicate pending approval type during approval update', async () => {
    prisma.orderApproval.findFirst
      .mockResolvedValueOnce({
        ...createPendingApprovalRecord(),
        status: ApprovalStatus.cancelled,
      })
      .mockResolvedValueOnce({
        id: 'approval-existing',
      });

    await expect(
      service.updateApproval('approval-1', {
        status: ApprovalStatus.pending,
        approvalTypeCode: 'estimate',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'This order already has a pending approval of the same type.',
      ),
    );
  });

  it('auto-transitions order status when estimate approval is approved', async () => {
    const tx = {
      orderApproval: {
        update: jest.fn().mockResolvedValue({ id: 'approval-1' }),
      },
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'order-1',
          organizationId: 'org-1',
          status: OrderStatus.estimated,
        }),
        update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
    };

    prisma.orderApproval.findFirst.mockResolvedValue(
      createPendingApprovalRecord(),
    );
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await service.updateApproval('approval-1', {
      status: ApprovalStatus.approved,
      approvedByStaffId: 'staff-1',
      decisionNote: 'Approved by test',
    });

    const approvalHistoryCalls = tx.orderStatusHistory.create.mock
      .calls as Array<
      [
        {
          data: {
            orderId: string;
            fromStatus: OrderStatus;
            toStatus: OrderStatus;
          };
        },
      ]
    >;
    const approvalHistoryArgs = approvalHistoryCalls[0]?.[0];
    expect(approvalHistoryArgs.data).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        fromStatus: OrderStatus.estimated,
        toStatus: OrderStatus.approved,
      }),
    );
    const orderUpdateCalls = tx.order.update.mock.calls as Array<
      [
        {
          where: { id: string };
          data: { status: OrderStatus };
        },
      ]
    >;
    const orderUpdateArgs = orderUpdateCalls[0]?.[0];
    expect(orderUpdateArgs.where).toEqual({ id: 'order-1' });
    expect(orderUpdateArgs.data).toEqual(
      expect.objectContaining({
        status: OrderStatus.approved,
      }),
    );
  });

  it('requires decision note when approval is rejected', async () => {
    prisma.orderApproval.findFirst.mockResolvedValue(
      createPendingApprovalRecord(),
    );

    await expect(
      service.updateApproval('approval-1', {
        status: ApprovalStatus.rejected,
        approvedByStaffId: 'staff-1',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Rejected approvals must include a decision note.',
      ),
    );
  });

  it('rejects workflow creation when branch belongs to another organization', async () => {
    (prisma as unknown as Record<string, unknown>).organization = {
      findFirst: jest.fn().mockResolvedValue({ id: 'org-1' }),
    };
    (prisma as unknown as Record<string, unknown>).branch = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-2',
      }),
    };

    await expect(
      service.createOrderWorkflow({
        organizationId: 'org-1',
        branchId: 'branch-1',
        createdByStaffId: 'staff-1',
        client: {
          fullName: 'Ali Valiyev',
        },
        asset: {
          assetTypeCode: 'vehicle',
          displayName: 'Cobalt',
        },
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Branch does not belong to the selected organization.',
      ),
    );
  });

  it('uses the max existing daily order sequence when generating order numbers', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-31T09:00:00.000Z'));

    try {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue(undefined),
        order: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { orderNumber: 'ORD-260331-001' },
              { orderNumber: 'ORD-260331-003' },
              { orderNumber: 'ORD-260331-custom' },
            ]),
        },
      };

      const nextOrderNumber = await (
        service as unknown as {
          generateOrderNumber: (
            txClient: typeof tx,
            organizationId: string,
          ) => Promise<string>;
        }
      ).generateOrderNumber(tx, 'org-1');

      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(nextOrderNumber).toBe('ORD-260331-004');
    } finally {
      jest.useRealTimers();
    }
  });
});
