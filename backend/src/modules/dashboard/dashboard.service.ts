import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    user: AuthenticatedUser | undefined,
    organizationId: string,
    branchId?: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required.');
    }

    if (branchId) {
      const branch = await this.ensureBranchExists(branchId);
      this.ensureUserHasOrganizationAccess(user, branch.organizationId);

      if (branch.organizationId !== organizationId) {
        throw new BadRequestException(
          'Branch does not belong to the selected organization.',
        );
      }
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const orderWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    };

    const financialWhere: Prisma.OrderFinancialWhereInput = {
      organizationId,
      deletedAt: null,
      ...(branchId
        ? {
            order: {
              branchId,
            },
          }
        : {}),
    };

    const paymentWhere: Prisma.PaymentWhereInput = {
      organizationId,
      deletedAt: null,
      ...(branchId
        ? {
            order: {
              branchId,
            },
          }
        : {}),
    };

    const expenseWhere: Prisma.ExpenseWhereInput = {
      organizationId,
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    };

    const stockWhere: Prisma.InventoryStockWhereInput = {
      organizationId,
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    };

    const [
      totalOrders,
      todayOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      orderStatusCounts,
      financialTotals,
      todayPayments,
      totalExpenses,
      lowStockItems,
      overdueBalances,
      topDebtors,
    ] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.count({
        where: {
          ...orderWhere,
          openedAt: {
            gte: startOfToday,
            lt: endOfToday,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderWhere,
          status: {
            in: [
              OrderStatus.pending_diagnosis,
              OrderStatus.estimated,
              OrderStatus.approved,
              OrderStatus.in_progress,
              OrderStatus.waiting_parts,
            ],
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderWhere,
          status: OrderStatus.completed,
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderWhere,
          status: OrderStatus.cancelled,
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: orderWhere,
        _count: {
          status: true,
        },
      }),
      this.prisma.orderFinancial.aggregate({
        where: financialWhere,
        _sum: {
          grandTotalAmount: true,
          paidTotalAmount: true,
          balanceDueAmount: true,
          subtotalLaborAmount: true,
          subtotalPartsAmount: true,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...paymentWhere,
          paidAt: {
            gte: startOfToday,
            lt: endOfToday,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.expense.aggregate({
        where: expenseWhere,
        _sum: {
          amount: true,
        },
      }),
      this.prisma.inventoryStock.count({
        where: {
          ...stockWhere,
          quantityOnHand: {
            lte: new Prisma.Decimal(0),
          },
        },
      }),
      this.prisma.orderFinancial.count({
        where: {
          ...financialWhere,
          balanceDueAmount: {
            gt: new Prisma.Decimal(0),
          },
        },
      }),
      this.prisma.order.findMany({
        where: {
          ...orderWhere,
          financial: {
            balanceDueAmount: {
              gt: new Prisma.Decimal(0),
            },
          },
        },
        orderBy: {
          financial: {
            balanceDueAmount: 'desc',
          },
        },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          client: {
            select: {
              fullName: true,
            },
          },
          asset: {
            select: {
              displayName: true,
            },
          },
          financial: {
            select: {
              paidTotalAmount: true,
              balanceDueAmount: true,
            },
          },
        },
      }),
    ]);

    return {
      scope: {
        organizationId,
        branchId: branchId ?? null,
      },
      orders: {
        total: totalOrders,
        today: todayOrders,
        active: activeOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
        byStatus: orderStatusCounts.map((item) => ({
          status: item.status,
          count: item._count.status,
        })),
      },
      finance: {
        grandTotal: this.toNumber(financialTotals._sum.grandTotalAmount),
        paidTotal: this.toNumber(financialTotals._sum.paidTotalAmount),
        balanceDue: this.toNumber(financialTotals._sum.balanceDueAmount),
        laborTotal: this.toNumber(financialTotals._sum.subtotalLaborAmount),
        partsTotal: this.toNumber(financialTotals._sum.subtotalPartsAmount),
        todayPayments: this.toNumber(todayPayments._sum.amount),
        expensesTotal: this.toNumber(totalExpenses._sum.amount),
        overdueBalanceOrders: overdueBalances,
        topDebtors: topDebtors.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          clientName: order.client.fullName,
          assetName: order.asset.displayName,
          paidTotalAmount: this.toNumber(order.financial?.paidTotalAmount),
          balanceDueAmount: this.toNumber(order.financial?.balanceDueAmount),
        })),
      },
      inventory: {
        outOfStockItems: lowStockItems,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value == null) {
      return 0;
    }

    return Number(value);
  }

  private async ensureBranchExists(id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found.');
    }

    return branch;
  }

  private ensureUserHasOrganizationAccess(
    user: AuthenticatedUser | undefined,
    organizationId: string,
  ) {
    if (
      user &&
      !user.isPlatformAdmin &&
      !user.organizationIds.includes(organizationId)
    ) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
  }
}
