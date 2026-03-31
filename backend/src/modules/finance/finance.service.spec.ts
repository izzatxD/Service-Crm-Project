import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { createBaseFinancePrismaMock } from '../../test-utils/workflow-test-mocks';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: {
    organization: { findFirst: jest.Mock };
    order: { findFirst: jest.Mock };
    paymentMethodTypeOrg: { findFirst: jest.Mock };
    orderFinancial: { findFirst: jest.Mock };
    payment: { aggregate: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = createBaseFinancePrismaMock();

    service = new FinanceService(prisma as unknown as PrismaService);
  });

  it('rejects payments for cancelled orders', async () => {
    await expect(
      service.createPayment({
        organizationId: 'org-1',
        orderId: 'order-1',
        paymentMethodCode: 'cash',
        amount: 100,
        paidAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Payments cannot be recorded for cancelled orders.',
      ),
    );
  });

  it('rejects invalid payment date before querying the database', async () => {
    await expect(
      service.createPayment({
        organizationId: 'org-1',
        orderId: 'order-1',
        paymentMethodCode: 'cash',
        amount: 100,
        paidAt: 'not-a-date',
      }),
    ).rejects.toThrow(new BadRequestException('Payment date is invalid.'));

    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('rejects payments that exceed remaining order debt', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      organizationId: 'org-1',
      status: OrderStatus.completed,
    });
    prisma.orderFinancial.findFirst.mockResolvedValue({
      id: 'financial-1',
      grandTotalAmount: 1000,
    });
    prisma.payment.aggregate.mockResolvedValue({
      _sum: {
        amount: 950,
      },
    });

    await expect(
      service.createPayment({
        organizationId: 'org-1',
        orderId: 'order-1',
        paymentMethodCode: 'cash',
        amount: 100,
        paidAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(
      new BadRequestException(
        "To'lov summasi zakazning qolgan qarzidan oshib ketdi.",
      ),
    );
  });
});
