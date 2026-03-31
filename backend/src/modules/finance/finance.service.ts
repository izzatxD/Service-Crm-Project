import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  findPaymentMethods(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.paymentMethodTypeOrg.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createPaymentMethod(
    payload: CreatePaymentMethodDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    await this.ensureOrganizationExists(payload.organizationId);

    return this.prisma.paymentMethodTypeOrg.create({
      data: {
        organizationId: payload.organizationId,
        paymentMethodCode: payload.paymentMethodCode,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updatePaymentMethod(
    id: string,
    payload: UpdatePaymentMethodDto,
    user?: AuthenticatedUser,
  ) {
    const paymentMethod = await this.ensurePaymentMethodExists(id);
    this.ensureUserHasOrganizationAccess(user, paymentMethod.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== paymentMethod.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing payment method is not supported.',
      );
    }

    return this.prisma.paymentMethodTypeOrg.update({
      where: { id },
      data: payload,
    });
  }

  async removePaymentMethod(id: string, user?: AuthenticatedUser) {
    const paymentMethod = await this.ensurePaymentMethodExists(id);
    this.ensureUserHasOrganizationAccess(user, paymentMethod.organizationId);

    return this.prisma.paymentMethodTypeOrg.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async findPayments(user: AuthenticatedUser, orderId?: string) {
    if (orderId) {
      const order = await this.ensureOrderExists(orderId);
      this.ensureUserHasOrganizationAccess(user, order.organizationId);
    }

    return this.prisma.payment.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderId ? { orderId } : {}),
      },
      include: {
        order: true,
        receivedByStaff: true,
      },
      orderBy: {
        paidAt: 'desc',
      },
    });
  }

  async createPayment(payload: CreatePaymentDto, user?: AuthenticatedUser) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    await this.validatePaymentPayload(payload);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          ...payload,
          paidAt: new Date(payload.paidAt),
        },
      });

      await this.syncOrderFinancialTotals(tx, payload.orderId);

      return payment;
    });
  }

  async updatePayment(
    id: string,
    payload: UpdatePaymentDto,
    user?: AuthenticatedUser,
  ) {
    const existingPayment = await this.ensurePaymentExists(id);
    this.ensureUserHasOrganizationAccess(user, existingPayment.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== existingPayment.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing payment is not supported.',
      );
    }

    const mergedPayload = {
      organizationId: payload.organizationId ?? existingPayment.organizationId,
      orderId: payload.orderId ?? existingPayment.orderId,
      paymentMethodCode:
        payload.paymentMethodCode ?? existingPayment.paymentMethodCode,
      amount: payload.amount ?? Number(existingPayment.amount),
      paidAt: payload.paidAt ?? existingPayment.paidAt.toISOString(),
      receivedByStaffId:
        payload.receivedByStaffId === undefined
          ? (existingPayment.receivedByStaffId ?? undefined)
          : (payload.receivedByStaffId ?? undefined),
      note: payload.note ?? existingPayment.note ?? undefined,
    };

    await this.validatePaymentPayload(mergedPayload, existingPayment.id);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id },
        data: {
          ...payload,
          paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
        },
      });

      await this.syncOrderFinancialTotals(tx, mergedPayload.orderId);

      if (existingPayment.orderId !== mergedPayload.orderId) {
        await this.syncOrderFinancialTotals(tx, existingPayment.orderId);
      }

      return payment;
    });
  }

  async removePayment(id: string, user?: AuthenticatedUser) {
    const payment = await this.ensurePaymentExists(id);
    this.ensureUserHasOrganizationAccess(user, payment.organizationId);

    return this.prisma.$transaction(async (tx) => {
      const removedPayment = await tx.payment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      await this.syncOrderFinancialTotals(tx, payment.orderId);

      return removedPayment;
    });
  }

  findExpenseCategories(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.expenseCategory.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createExpenseCategory(
    payload: CreateExpenseCategoryDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    await this.ensureOrganizationExists(payload.organizationId);

    return this.prisma.expenseCategory.create({
      data: {
        organizationId: payload.organizationId,
        name: payload.name,
        code: payload.code,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateExpenseCategory(
    id: string,
    payload: UpdateExpenseCategoryDto,
    user?: AuthenticatedUser,
  ) {
    const category = await this.ensureExpenseCategoryExists(id);
    this.ensureUserHasOrganizationAccess(user, category.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== category.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing expense category is not supported.',
      );
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: payload,
    });
  }

  async removeExpenseCategory(id: string, user?: AuthenticatedUser) {
    const category = await this.ensureExpenseCategoryExists(id);
    this.ensureUserHasOrganizationAccess(user, category.organizationId);

    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  findExpenses(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.expense.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      include: {
        branch: true,
        expenseCategory: true,
        relatedOrder: true,
        createdByStaff: true,
      },
      orderBy: {
        expenseDate: 'desc',
      },
    });
  }

  async createExpense(payload: CreateExpenseDto, user?: AuthenticatedUser) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    await this.validateExpensePayload(payload);

    return this.prisma.expense.create({
      data: {
        ...payload,
        expenseDate: new Date(payload.expenseDate),
      },
    });
  }

  async updateExpense(
    id: string,
    payload: UpdateExpenseDto,
    user?: AuthenticatedUser,
  ) {
    const existingExpense = await this.ensureExpenseExists(id);
    this.ensureUserHasOrganizationAccess(user, existingExpense.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== existingExpense.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing expense is not supported.',
      );
    }

    const mergedPayload = {
      organizationId: payload.organizationId ?? existingExpense.organizationId,
      branchId:
        payload.branchId === undefined
          ? (existingExpense.branchId ?? undefined)
          : (payload.branchId ?? undefined),
      expenseCategoryId:
        payload.expenseCategoryId ?? existingExpense.expenseCategoryId,
      title: payload.title ?? existingExpense.title,
      amount: payload.amount ?? Number(existingExpense.amount),
      relatedOrderId:
        payload.relatedOrderId === undefined
          ? (existingExpense.relatedOrderId ?? undefined)
          : (payload.relatedOrderId ?? undefined),
      createdByStaffId:
        payload.createdByStaffId === undefined
          ? (existingExpense.createdByStaffId ?? undefined)
          : (payload.createdByStaffId ?? undefined),
      expenseDate:
        payload.expenseDate ?? existingExpense.expenseDate.toISOString(),
      note: payload.note ?? existingExpense.note ?? undefined,
    };

    await this.validateExpensePayload(mergedPayload);

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...payload,
        expenseDate: payload.expenseDate
          ? new Date(payload.expenseDate)
          : undefined,
      },
    });
  }

  async removeExpense(id: string, user?: AuthenticatedUser) {
    const expense = await this.ensureExpenseExists(id);
    this.ensureUserHasOrganizationAccess(user, expense.organizationId);

    return this.prisma.expense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async validatePaymentPayload(
    payload: {
      organizationId: string;
      orderId: string;
      paymentMethodCode: string;
      amount: number;
      paidAt: string;
      receivedByStaffId?: string;
    },
    excludingPaymentId?: string,
  ) {
    if (payload.amount <= 0) {
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );
    }

    const parsedPaidAt = new Date(payload.paidAt);
    if (Number.isNaN(parsedPaidAt.getTime())) {
      throw new BadRequestException('Payment date is invalid.');
    }

    const [organization, order, paymentMethod, financial, paymentAggregate] =
      await Promise.all([
        this.ensureOrganizationExists(payload.organizationId),
        this.ensureOrderExists(payload.orderId),
        this.ensurePaymentMethodForOrganization(
          payload.organizationId,
          payload.paymentMethodCode,
        ),
        this.prisma.orderFinancial.findFirst({
          where: {
            orderId: payload.orderId,
            deletedAt: null,
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            orderId: payload.orderId,
            deletedAt: null,
            ...(excludingPaymentId ? { id: { not: excludingPaymentId } } : {}),
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

    if (!organization.isActive) {
      throw new BadRequestException('Organization is inactive.');
    }

    if (order.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Order does not belong to the selected organization.',
      );
    }

    if (order.status === OrderStatus.cancelled) {
      throw new BadRequestException(
        'Payments cannot be recorded for cancelled orders.',
      );
    }

    if (!paymentMethod.isActive) {
      throw new BadRequestException('Selected payment method is inactive.');
    }

    if (!financial) {
      throw new BadRequestException('Order financial record not found.');
    }

    const nextPaidTotal =
      Number(paymentAggregate._sum.amount ?? 0) + Number(payload.amount);
    const grandTotal = Number(financial.grandTotalAmount);

    if (nextPaidTotal - grandTotal > 0.01) {
      throw new BadRequestException(
        "To'lov summasi zakazning qolgan qarzidan oshib ketdi.",
      );
    }

    if (payload.receivedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.receivedByStaffId,
        payload.organizationId,
      );
    }
  }

  private async validateExpensePayload(payload: {
    organizationId: string;
    branchId?: string;
    expenseCategoryId: string;
    amount: number;
    relatedOrderId?: string;
    createdByStaffId?: string;
    expenseDate: string;
  }) {
    if (payload.amount <= 0) {
      throw new BadRequestException(
        'Expense amount must be greater than zero.',
      );
    }

    await this.ensureOrganizationExists(payload.organizationId);
    const category = await this.ensureExpenseCategoryExists(
      payload.expenseCategoryId,
    );

    if (category.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Expense category does not belong to the selected organization.',
      );
    }

    if (payload.branchId) {
      const branch = await this.ensureBranchExists(payload.branchId);
      if (branch.organizationId !== payload.organizationId) {
        throw new BadRequestException(
          'Branch does not belong to the selected organization.',
        );
      }
    }

    if (payload.relatedOrderId) {
      const order = await this.ensureOrderExists(payload.relatedOrderId);
      if (order.organizationId !== payload.organizationId) {
        throw new BadRequestException(
          'Related order does not belong to the selected organization.',
        );
      }
    }

    if (payload.createdByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.createdByStaffId,
        payload.organizationId,
      );
    }
  }

  private async syncOrderFinancialTotals(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const financial = await tx.orderFinancial.findFirst({
      where: {
        orderId,
        deletedAt: null,
      },
    });

    if (!financial) {
      return;
    }

    const paymentAggregate = await tx.payment.aggregate({
      where: {
        orderId,
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    });

    const paidTotalAmount =
      paymentAggregate._sum.amount ?? new Prisma.Decimal(0);
    const grandTotalAmount = financial.grandTotalAmount;
    const balanceDueAmount = grandTotalAmount.minus(paidTotalAmount);

    await tx.orderFinancial.update({
      where: { id: financial.id },
      data: {
        paidTotalAmount,
        balanceDueAmount: balanceDueAmount.greaterThan(0)
          ? balanceDueAmount
          : new Prisma.Decimal(0),
      },
    });
  }

  private async ensureOrganizationExists(id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    return organization;
  }

  private async ensureOrderExists(id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
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

  private async ensureStaffBelongsToOrganization(
    staffId: string,
    organizationId: string,
  ) {
    const staff = await this.prisma.staffMember.findFirst({
      where: {
        id: staffId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!staff) {
      throw new BadRequestException(
        'Selected staff member does not belong to the selected organization.',
      );
    }

    return staff;
  }

  private async ensurePaymentMethodExists(id: string) {
    const paymentMethod = await this.prisma.paymentMethodTypeOrg.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found.');
    }

    return paymentMethod;
  }

  private async ensurePaymentMethodForOrganization(
    organizationId: string,
    paymentMethodCode: string,
  ) {
    const paymentMethod = await this.prisma.paymentMethodTypeOrg.findFirst({
      where: {
        organizationId,
        paymentMethodCode: paymentMethodCode as never,
        deletedAt: null,
      },
    });

    if (!paymentMethod) {
      throw new BadRequestException(
        'Payment method is not configured for the selected organization.',
      );
    }

    return paymentMethod;
  }

  private async ensurePaymentExists(id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    return payment;
  }

  private async ensureExpenseCategoryExists(id: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Expense category not found.');
    }

    return category;
  }

  private async ensureExpenseExists(id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    return expense;
  }

  private getOrganizationScope(
    user?: AuthenticatedUser,
    organizationId?: string,
  ): Record<string, unknown> {
    if (!user || user.isPlatformAdmin) {
      return organizationId ? { organizationId } : {};
    }

    if (organizationId) {
      this.ensureUserHasOrganizationAccess(user, organizationId);
      return { organizationId };
    }

    return { organizationId: { in: user.organizationIds } };
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
