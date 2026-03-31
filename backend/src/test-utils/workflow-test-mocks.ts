import { ApprovalStatus, OrderStatus } from '@prisma/client';

export function createBaseOrdersPrismaMock() {
  return {
    order: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'order-1',
        organizationId: 'org-1',
        status: OrderStatus.estimated,
      }),
    },
    orderTask: {
      count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    },
    orderFinancial: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'financial-1',
        balanceDueAmount: 500,
      }),
    },
    staffMember: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'staff-1',
        organizationId: 'org-1',
        isActive: true,
      }),
    },
    orderApproval: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'approval-existing',
      }),
    },
    $transaction: jest.fn(),
  };
}

export function createBaseFinancePrismaMock() {
  return {
    organization: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'org-1',
        isActive: true,
      }),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'order-1',
        organizationId: 'org-1',
        status: OrderStatus.cancelled,
      }),
    },
    paymentMethodTypeOrg: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'method-1',
        isActive: true,
      }),
    },
    orderFinancial: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'financial-1',
        grandTotalAmount: 1000,
      }),
    },
    payment: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          amount: 0,
        },
      }),
    },
    $transaction: jest.fn(),
  };
}

export function createPendingApprovalRecord() {
  return {
    id: 'approval-1',
    orderId: 'order-1',
    organizationId: 'org-1',
    approvalTypeCode: 'estimate',
    status: ApprovalStatus.pending,
    requestedByStaffId: 'staff-1',
    approvedByStaffId: null,
    decisionNote: null,
  };
}
