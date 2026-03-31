import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  OrderAssignmentStatus,
  OrderStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { CreateOrderApprovalDto } from './dto/create-order-approval.dto';
import { CreateOrderAssignmentDto } from './dto/create-order-assignment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderFinancialDto } from './dto/create-order-financial.dto';
import { CreateOrderWorkflowDto } from './dto/create-order-workflow.dto';
import { CreateOrderStatusHistoryDto } from './dto/create-order-status-history.dto';
import { CreateOrderTaskDto } from './dto/create-order-task.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateOrderApprovalDto } from './dto/update-order-approval.dto';
import { UpdateOrderAssignmentDto } from './dto/update-order-assignment.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderFinancialDto } from './dto/update-order-financial.dto';
import { UpdateOrderStatusHistoryDto } from './dto/update-order-status-history.dto';
import { UpdateOrderTaskDto } from './dto/update-order-task.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.new]: [
    OrderStatus.pending_diagnosis,
    OrderStatus.estimated,
    OrderStatus.cancelled,
  ],
  [OrderStatus.pending_diagnosis]: [
    OrderStatus.estimated,
    OrderStatus.in_progress,
    OrderStatus.cancelled,
  ],
  [OrderStatus.estimated]: [OrderStatus.approved, OrderStatus.cancelled],
  [OrderStatus.approved]: [
    OrderStatus.in_progress,
    OrderStatus.waiting_parts,
    OrderStatus.cancelled,
  ],
  [OrderStatus.in_progress]: [
    OrderStatus.waiting_parts,
    OrderStatus.completed,
    OrderStatus.cancelled,
  ],
  [OrderStatus.waiting_parts]: [
    OrderStatus.in_progress,
    OrderStatus.completed,
    OrderStatus.cancelled,
  ],
  [OrderStatus.completed]: [OrderStatus.delivered],
  [OrderStatus.delivered]: [],
  [OrderStatus.cancelled]: [],
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findServiceCategories(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.serviceCategory.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createServiceCategory(
    payload: CreateServiceCategoryDto,
    user?: AuthenticatedUser,
  ) {
    if (user) {
      this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    }

    await this.ensureOrganizationExists(payload.organizationId);

    return this.prisma.serviceCategory.create({
      data: {
        organizationId: payload.organizationId,
        name: payload.name,
        code: payload.code,
        sortOrder: payload.sortOrder ?? 100,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateServiceCategory(
    id: string,
    payload: UpdateServiceCategoryDto,
    user?: AuthenticatedUser,
  ) {
    const category = await this.ensureServiceCategoryExists(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== category.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing service category is not supported. Create a new service category in the target organization instead.',
      );
    }

    if (payload.organizationId) {
      await this.ensureOrganizationExists(payload.organizationId);
    }

    return this.prisma.serviceCategory.update({
      where: { id },
      data: payload,
    });
  }

  async removeServiceCategory(id: string, user?: AuthenticatedUser) {
    await this.ensureServiceCategoryExists(id, user);

    return this.prisma.serviceCategory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  findServices(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.service.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      include: {
        category: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createService(payload: CreateServiceDto, user?: AuthenticatedUser) {
    if (user) {
      this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    }

    await this.ensureOrganizationExists(payload.organizationId);
    const category = await this.ensureServiceCategoryExists(
      payload.categoryId,
      user,
    );

    if (category.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Service category does not belong to the selected organization.',
      );
    }

    return this.prisma.service.create({
      data: payload,
    });
  }

  async updateService(
    id: string,
    payload: UpdateServiceDto,
    user?: AuthenticatedUser,
  ) {
    const service = await this.ensureServiceExists(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== service.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing service is not supported. Create a new service in the target organization instead.',
      );
    }

    if (payload.organizationId) {
      await this.ensureOrganizationExists(payload.organizationId);
    }

    if (payload.categoryId) {
      const category = await this.ensureServiceCategoryExists(
        payload.categoryId,
        user,
      );
      const targetOrganizationId =
        payload.organizationId ?? service.organizationId;

      if (category.organizationId !== targetOrganizationId) {
        throw new BadRequestException(
          'Service category does not belong to the selected organization.',
        );
      }
    }

    return this.prisma.service.update({
      where: { id },
      data: payload,
    });
  }

  async removeService(id: string, user?: AuthenticatedUser) {
    await this.ensureServiceExists(id, user);

    return this.prisma.service.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  findOrders(user: AuthenticatedUser, organizationId?: string) {
    const isWorkerOnly =
      !user.isPlatformAdmin &&
      !user.permissionCodes.includes('order.update') &&
      !user.permissionCodes.includes('order.approve') &&
      !user.permissionCodes.includes('order.create') &&
      user.permissionCodes.includes('task.update') &&
      Boolean(user.staffMemberId);

    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
        ...(isWorkerOnly
          ? {
              tasks: {
                some: {
                  assignedStaffId: user.staffMemberId,
                  deletedAt: null,
                },
              },
            }
          : {}),
      },
      include: {
        branch: true,
        client: true,
        asset: true,
        createdByStaff: true,
        assignedManager: true,
        tasks: {
          where: {
            deletedAt: null,
          },
          include: {
            assignedStaff: true,
          },
        },
        financial: true,
      },
      orderBy: {
        openedAt: 'desc',
      },
    });
  }

  async findOrderById(id: string, user?: AuthenticatedUser) {
    const isWorkerOnly =
      user &&
      !user.isPlatformAdmin &&
      !user.permissionCodes.includes('order.update') &&
      !user.permissionCodes.includes('order.approve') &&
      !user.permissionCodes.includes('order.create') &&
      user.permissionCodes.includes('task.update') &&
      Boolean(user.staffMemberId);

    const order = await this.prisma.order.findFirst({
      where: {
        id,
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(isWorkerOnly
          ? {
              tasks: {
                some: {
                  assignedStaffId: user.staffMemberId,
                  deletedAt: null,
                },
              },
            }
          : {}),
      },
      include: {
        branch: true,
        client: true,
        asset: true,
        createdByStaff: true,
        assignedManager: true,
        tasks: {
          where: {
            deletedAt: null,
          },
          include: {
            assignedStaff: true,
          },
        },
        assignments: {
          where: {
            deletedAt: null,
          },
          include: {
            orderTask: true,
            fromStaff: true,
            toStaff: true,
            assignedByStaff: true,
            acceptedByStaff: true,
          },
        },
        approvals: {
          where: {
            deletedAt: null,
          },
          include: {
            requestedByStaff: true,
            approvedByStaff: true,
          },
        },
        statusHistory: {
          where: {
            deletedAt: null,
          },
        },
        financial: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }

  async createOrder(payload: CreateOrderDto, user?: AuthenticatedUser) {
    await this.validateOrderRelations(payload, user);

    const status = payload.status ?? OrderStatus.new;
    const priority = payload.priority;

    return this.prisma.$transaction(async (tx) => {
      const orderNumber =
        payload.orderNumber ??
        (await this.generateOrderNumber(tx, payload.organizationId));

      const order = await tx.order.create({
        data: {
          organizationId: payload.organizationId,
          branchId: payload.branchId,
          orderNumber,
          clientId: payload.clientId,
          assetId: payload.assetId,
          createdByStaffId: payload.createdByStaffId,
          assignedManagerId: payload.assignedManagerId,
          status,
          priority,
          customerRequestText: payload.customerRequestText,
          intakeNotes: payload.intakeNotes,
          internalDiagnosisText: payload.internalDiagnosisText,
        },
      });

      await tx.orderFinancial.create({
        data: {
          orderId: order.id,
          organizationId: payload.organizationId,
          subtotalLaborAmount: new Prisma.Decimal(0),
          subtotalPartsAmount: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          grandTotalAmount: new Prisma.Decimal(0),
          paidTotalAmount: new Prisma.Decimal(0),
          balanceDueAmount: new Prisma.Decimal(0),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          organizationId: payload.organizationId,
          orderId: order.id,
          fromStatus: null,
          toStatus: status,
          changedByStaffId: payload.createdByStaffId,
          note: 'Initial order creation',
          customerVisible: false,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          branch: true,
          client: true,
          asset: true,
          createdByStaff: true,
          assignedManager: true,
          financial: true,
        },
      });
    });
  }

  async createOrderWorkflow(
    payload: CreateOrderWorkflowDto,
    user?: AuthenticatedUser,
  ) {
    if (user) {
      this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    }

    await this.ensureOrganizationExists(payload.organizationId);
    const branch = await this.ensureBranchExists(payload.branchId);

    if (branch.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Branch does not belong to the selected organization.',
      );
    }

    await this.ensureStaffBelongsToOrganization(
      payload.createdByStaffId,
      payload.organizationId,
    );

    if (payload.assignedManagerId) {
      await this.ensureStaffBelongsToOrganization(
        payload.assignedManagerId,
        payload.organizationId,
      );
    }

    if (payload.tasks?.length) {
      const lineNos = payload.tasks.map((task) => task.lineNo);
      if (new Set(lineNos).size !== lineNos.length) {
        throw new BadRequestException(
          'Task line numbers must be unique inside the workflow payload.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId: payload.organizationId,
          fullName: payload.client.fullName,
          phone: payload.client.phone,
          note: payload.client.note,
        },
      });

      const asset = await tx.asset.create({
        data: {
          organizationId: payload.organizationId,
          clientId: client.id,
          assetTypeCode: payload.asset.assetTypeCode,
          displayName: payload.asset.displayName,
          statusCode: payload.asset.statusCode,
          note: payload.asset.note,
        },
      });

      if (payload.vehicleProfile) {
        await tx.vehicleProfile.create({
          data: {
            assetId: asset.id,
            organizationId: payload.organizationId,
            make: payload.vehicleProfile.make,
            model: payload.vehicleProfile.model,
            year: payload.vehicleProfile.year,
            plateNumber: payload.vehicleProfile.plateNumber,
            vin: payload.vehicleProfile.vin,
            engineType: payload.vehicleProfile.engineType,
            mileage: payload.vehicleProfile.mileage,
          },
        });
      }

      const orderStatus = payload.status ?? OrderStatus.new;
      const orderNumber =
        payload.orderNumber ??
        (await this.generateOrderNumber(tx, payload.organizationId));

      const order = await tx.order.create({
        data: {
          organizationId: payload.organizationId,
          branchId: payload.branchId,
          orderNumber,
          clientId: client.id,
          assetId: asset.id,
          createdByStaffId: payload.createdByStaffId,
          assignedManagerId: payload.assignedManagerId,
          status: orderStatus,
          priority: payload.priority,
          customerRequestText: payload.customerRequestText,
          intakeNotes: payload.intakeNotes,
          internalDiagnosisText: payload.internalDiagnosisText,
        },
      });

      let subtotalLaborAmount = new Prisma.Decimal(0);

      for (const task of payload.tasks ?? []) {
        if (task.serviceId) {
          const service = await tx.service.findFirst({
            where: {
              id: task.serviceId,
              organizationId: payload.organizationId,
              deletedAt: null,
            },
          });

          if (!service) {
            throw new BadRequestException(
              'One of the selected services does not belong to the organization.',
            );
          }
        }

        if (task.assignedStaffId) {
          const assignedStaff = await tx.staffMember.findFirst({
            where: {
              id: task.assignedStaffId,
              organizationId: payload.organizationId,
              deletedAt: null,
            },
          });

          if (!assignedStaff) {
            throw new BadRequestException(
              'One of the assigned staff members does not belong to the organization.',
            );
          }
        }

        await tx.orderTask.create({
          data: {
            organizationId: payload.organizationId,
            orderId: order.id,
            lineNo: task.lineNo,
            serviceId: task.serviceId,
            title: task.title,
            assignedStaffId: task.assignedStaffId,
            status: task.status ?? TaskStatus.pending,
            estimatedLaborAmount: new Prisma.Decimal(
              task.estimatedLaborAmount ?? 0,
            ),
            actualLaborAmount: new Prisma.Decimal(task.actualLaborAmount ?? 0),
            note: task.note,
          },
        });
        subtotalLaborAmount = subtotalLaborAmount.plus(
          new Prisma.Decimal(task.estimatedLaborAmount ?? 0),
        );
      }

      const grandTotalAmount = subtotalLaborAmount;
      await tx.orderFinancial.create({
        data: {
          orderId: order.id,
          organizationId: payload.organizationId,
          subtotalLaborAmount,
          subtotalPartsAmount: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          grandTotalAmount,
          paidTotalAmount: new Prisma.Decimal(0),
          balanceDueAmount: grandTotalAmount,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          organizationId: payload.organizationId,
          orderId: order.id,
          fromStatus: null,
          toStatus: orderStatus,
          changedByStaffId: payload.createdByStaffId,
          note: 'Initial workflow order creation',
          customerVisible: false,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          client: true,
          asset: {
            include: {
              vehicleProfile: true,
            },
          },
          tasks: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              lineNo: 'asc',
            },
          },
          financial: true,
          branch: true,
          createdByStaff: true,
          assignedManager: true,
        },
      });
    });
  }

  async updateOrder(
    id: string,
    payload: UpdateOrderDto,
    user?: AuthenticatedUser,
  ) {
    const currentOrder = await this.findOrderById(id, user);
    this.ensureOrderUpdatePayloadIsAllowed(user, payload);

    if (
      payload.organizationId &&
      payload.organizationId !== currentOrder.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing order is not supported. Create a new order in the target organization instead.',
      );
    }

    if (
      payload.organizationId ||
      payload.branchId ||
      payload.clientId ||
      payload.assetId ||
      payload.createdByStaffId ||
      payload.assignedManagerId !== undefined
    ) {
      await this.validateOrderRelations(
        {
          organizationId: currentOrder.organizationId,
          branchId: payload.branchId ?? currentOrder.branchId,
          clientId: payload.clientId ?? currentOrder.clientId,
          assetId: payload.assetId ?? currentOrder.assetId,
          createdByStaffId:
            payload.createdByStaffId ?? currentOrder.createdByStaffId,
          assignedManagerId:
            payload.assignedManagerId === undefined
              ? (currentOrder.assignedManagerId ?? undefined)
              : (payload.assignedManagerId ?? undefined),
        },
        user,
      );
    }

    const { payment, ...updateData } = payload;
    const nextStatus = updateData.status;

    let closedAt: Date | null | undefined;
    let deliveredAt: Date | null | undefined;

    if (nextStatus && nextStatus !== currentOrder.status) {
      this.ensureValidOrderTransition(currentOrder.status, nextStatus);
      await this.ensureStatusRequirements(currentOrder.id, nextStatus);

      closedAt =
        nextStatus === OrderStatus.completed
          ? new Date()
          : currentOrder.closedAt
            ? null
            : undefined;
      deliveredAt =
        nextStatus === OrderStatus.delivered
          ? new Date()
          : currentOrder.deliveredAt
            ? null
            : undefined;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          ...updateData,
          closedAt,
          deliveredAt,
        },
      });

      if (payment && (payment.cash || payment.card)) {
        const staffId = await this.resolveCurrentStaffMemberId(
          tx,
          user,
          currentOrder.organizationId,
        );

        if (payment.cash && payment.cash > 0) {
          const cashMethod = await tx.paymentMethodTypeOrg.findFirst({
            where: {
              paymentMethodCode: 'cash',
              organizationId: currentOrder.organizationId,
              deletedAt: null,
            },
          });
          if (!cashMethod) {
            throw new BadRequestException(
              "Naqd pul to'lov usuli (cash) ushbu tashkilot uchun sozlanmagan. Avval sozlamalarda 'cash' to'lov usulini yoqing.",
            );
          }
          await tx.payment.create({
            data: {
              organizationId: currentOrder.organizationId,
              orderId: id,
              paymentMethodCode: 'cash',
              amount: new Prisma.Decimal(payment.cash),
              paidAt: new Date(),
              receivedByStaffId: staffId,
              note: 'Order checkout (Cash)',
            },
          });
        }

        if (payment.card && payment.card > 0) {
          const cardMethod = await tx.paymentMethodTypeOrg.findFirst({
            where: {
              paymentMethodCode: 'card',
              organizationId: currentOrder.organizationId,
              deletedAt: null,
            },
          });
          if (!cardMethod) {
            throw new BadRequestException(
              "Plastik karta to'lov usuli (card) ushbu tashkilot uchun sozlanmagan. Avval sozlamalarda 'card' to'lov usulini yoqing.",
            );
          }
          await tx.payment.create({
            data: {
              organizationId: currentOrder.organizationId,
              orderId: id,
              paymentMethodCode: 'card',
              amount: new Prisma.Decimal(payment.card),
              paidAt: new Date(),
              receivedByStaffId: staffId,
              note: 'Order checkout (Card)',
            },
          });
        }

        const paymentAggregate = await tx.payment.aggregate({
          where: { orderId: id, deletedAt: null },
          _sum: { amount: true },
        });

        const financial = await tx.orderFinancial.findFirst({
          where: { orderId: id, deletedAt: null },
        });

        if (financial) {
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
      }

      if (nextStatus && nextStatus !== currentOrder.status) {
        await tx.orderStatusHistory.create({
          data: {
            organizationId: currentOrder.organizationId,
            orderId: currentOrder.id,
            fromStatus: currentOrder.status,
            toStatus: nextStatus,
            changedByStaffId: await this.resolveCurrentStaffMemberId(
              tx,
              user,
              currentOrder.organizationId,
            ),
            note: 'Order status updated',
            customerVisible: false,
          },
        });
      }
    });

    return this.findOrderById(id, user);
  }

  async removeOrder(id: string, user?: AuthenticatedUser) {
    await this.findOrderById(id, user);
    return this.prisma.order.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async findOrderTasks(user: AuthenticatedUser, orderId?: string) {
    if (orderId) {
      await this.ensureOrderExists(orderId, user);
    }

    return this.prisma.orderTask.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderId ? { orderId } : {}),
      },
      include: {
        order: true,
        service: true,
        assignedStaff: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createOrderTask(payload: CreateOrderTaskDto, user?: AuthenticatedUser) {
    const order = await this.ensureOrderExists(payload.orderId, user);

    if (order.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Order task organization must match the parent order.',
      );
    }

    await this.ensureUniqueTaskLine(payload.orderId, payload.lineNo);

    if (payload.serviceId) {
      const service = await this.ensureServiceExists(payload.serviceId, user);
      if (service.organizationId !== payload.organizationId) {
        throw new BadRequestException(
          'Selected service does not belong to the selected organization.',
        );
      }
    }

    if (payload.assignedStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.assignedStaffId,
        payload.organizationId,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.orderTask.create({
        data: {
          ...payload,
          status: payload.status ?? TaskStatus.pending,
        },
      });

      await this.syncOrderFinancialFromTasks(tx, payload.orderId);

      return task;
    });
  }

  async updateOrderTask(
    id: string,
    payload: UpdateOrderTaskDto,
    user?: AuthenticatedUser,
  ) {
    const task = await this.ensureOrderTaskExists(id, user);
    this.ensureTaskCanBeUpdatedByUser(user, task, payload);

    if (
      payload.organizationId &&
      payload.organizationId !== task.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing order task is not supported. Create a new task in the target organization instead.',
      );
    }

    if (payload.lineNo && payload.lineNo !== task.lineNo) {
      await this.ensureUniqueTaskLine(task.orderId, payload.lineNo, id);
    }

    if (payload.serviceId) {
      const service = await this.ensureServiceExists(payload.serviceId, user);
      const organizationId = task.organizationId;

      if (service.organizationId !== organizationId) {
        throw new BadRequestException(
          'Selected service does not belong to the selected organization.',
        );
      }
    }

    if (payload.assignedStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.assignedStaffId,
        payload.organizationId ?? task.organizationId,
      );
    }

    let completedAt: Date | null | undefined;
    if (payload.status) {
      completedAt =
        payload.status === TaskStatus.completed
          ? new Date()
          : task.completedAt
            ? null
            : undefined;
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.orderTask.update({
        where: { id },
        data: {
          ...payload,
          startedAt:
            payload.status === TaskStatus.in_progress
              ? (task.startedAt ?? new Date())
              : undefined,
          completedAt,
        },
      });

      await this.syncOrderFinancialFromTasks(tx, task.orderId);

      return updatedTask;
    });
  }

  async removeOrderTask(id: string, user?: AuthenticatedUser) {
    const task = await this.ensureOrderTaskExists(id, user);
    return this.prisma.$transaction(async (tx) => {
      const deletedTask = await tx.orderTask.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      await this.syncOrderFinancialFromTasks(tx, task.orderId);

      return deletedTask;
    });
  }

  async findAssignments(user: AuthenticatedUser, orderId?: string) {
    if (orderId) {
      await this.ensureOrderExists(orderId, user);
    }

    return this.prisma.orderAssignment.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderId ? { orderId } : {}),
      },
      include: {
        order: true,
        orderTask: true,
        fromStaff: true,
        toStaff: true,
        assignedByStaff: true,
        acceptedByStaff: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
  }

  async createAssignment(
    payload: CreateOrderAssignmentDto,
    user?: AuthenticatedUser,
  ) {
    const order = await this.ensureOrderExists(payload.orderId, user);

    if (order.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Assignment organization must match the parent order.',
      );
    }

    if (payload.orderTaskId) {
      const task = await this.ensureOrderTaskExists(payload.orderTaskId, user);
      if (task.orderId !== payload.orderId) {
        throw new BadRequestException(
          'Assigned task does not belong to the selected order.',
        );
      }
    }

    if (payload.fromStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.fromStaffId,
        payload.organizationId,
      );
    }

    await this.ensureStaffBelongsToOrganization(
      payload.toStaffId,
      payload.organizationId,
    );
    await this.ensureStaffBelongsToOrganization(
      payload.assignedByStaffId,
      payload.organizationId,
    );

    if (payload.acceptedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.acceptedByStaffId,
        payload.organizationId,
      );
    }

    const assignmentStatus = payload.status ?? OrderAssignmentStatus.assigned;
    this.validateAssignmentStatusConsistency(
      assignmentStatus,
      payload.acceptedByStaffId,
    );

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.orderAssignment.create({
        data: {
          ...payload,
          status: assignmentStatus,
          acceptedAt:
            assignmentStatus === OrderAssignmentStatus.accepted
              ? new Date()
              : undefined,
          completedAt:
            assignmentStatus === OrderAssignmentStatus.completed
              ? new Date()
              : undefined,
        },
      });

      if (payload.orderTaskId) {
        await this.syncTaskWithAssignment(tx, payload.orderTaskId, {
          toStaffId: payload.toStaffId,
          status: assignmentStatus,
        });
      }

      return assignment;
    });
  }

  async updateAssignment(
    id: string,
    payload: UpdateOrderAssignmentDto,
    user?: AuthenticatedUser,
  ) {
    const assignment = await this.ensureAssignmentExists(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== assignment.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing assignment is not supported. Create a new assignment in the target organization instead.',
      );
    }

    const organizationId = assignment.organizationId;

    if (payload.orderId) {
      const order = await this.ensureOrderExists(payload.orderId, user);

      if (order.organizationId !== organizationId) {
        throw new BadRequestException(
          'Assignment organization must match the parent order.',
        );
      }
    }

    if (payload.fromStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.fromStaffId,
        organizationId,
      );
    }

    if (payload.toStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.toStaffId,
        organizationId,
      );
    }

    if (payload.assignedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.assignedByStaffId,
        organizationId,
      );
    }

    if (payload.acceptedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.acceptedByStaffId,
        organizationId,
      );
    }

    const nextStatus = payload.status ?? assignment.status;
    const acceptedByStaffId =
      payload.acceptedByStaffId === undefined
        ? assignment.acceptedByStaffId
        : payload.acceptedByStaffId;
    this.validateAssignmentStatusConsistency(nextStatus, acceptedByStaffId);

    let completedAt: Date | null | undefined;
    if (payload.status) {
      completedAt =
        payload.status === OrderAssignmentStatus.completed
          ? new Date()
          : assignment.completedAt
            ? null
            : undefined;
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.orderAssignment.update({
        where: { id },
        data: {
          ...payload,
          acceptedAt:
            payload.status === OrderAssignmentStatus.accepted
              ? (assignment.acceptedAt ?? new Date())
              : undefined,
          completedAt,
        },
      });

      const assignmentTaskId = payload.orderTaskId ?? assignment.orderTaskId;
      if (assignmentTaskId) {
        await this.syncTaskWithAssignment(tx, assignmentTaskId, {
          toStaffId: payload.toStaffId ?? assignment.toStaffId,
          status: nextStatus,
        });
      }

      return updatedAssignment;
    });
  }

  async removeAssignment(id: string, user?: AuthenticatedUser) {
    await this.ensureAssignmentExists(id, user);
    return this.prisma.orderAssignment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async findStatusHistory(user: AuthenticatedUser, orderId?: string) {
    if (orderId) {
      await this.ensureOrderExists(orderId, user);
    }

    return this.prisma.orderStatusHistory.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderId ? { orderId } : {}),
      },
      include: {
        order: true,
        changedByStaff: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createStatusHistory(
    payload: CreateOrderStatusHistoryDto,
    user?: AuthenticatedUser,
  ) {
    const order = await this.ensureOrderExists(payload.orderId, user);

    if (order.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Status history organization must match the parent order.',
      );
    }

    const expectedFromStatus = payload.fromStatus ?? order.status;
    if (expectedFromStatus !== order.status) {
      throw new BadRequestException(
        'Provided fromStatus does not match the current order status.',
      );
    }

    if (payload.changedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.changedByStaffId,
        payload.organizationId,
      );
    }

    this.ensureValidOrderTransition(order.status, payload.toStatus);
    await this.ensureStatusRequirements(order.id, payload.toStatus);

    return this.prisma.$transaction(async (tx) => {
      const history = await tx.orderStatusHistory.create({
        data: {
          organizationId: payload.organizationId,
          orderId: payload.orderId,
          fromStatus: order.status,
          toStatus: payload.toStatus,
          changedByStaffId: payload.changedByStaffId,
          note: payload.note,
          customerVisible: payload.customerVisible ?? false,
        },
      });

      await tx.order.update({
        where: { id: payload.orderId },
        data: {
          status: payload.toStatus,
          closedAt:
            payload.toStatus === OrderStatus.completed ? new Date() : undefined,
          deliveredAt:
            payload.toStatus === OrderStatus.delivered ? new Date() : undefined,
        },
      });

      return history;
    });
  }

  async updateStatusHistory(
    id: string,
    payload: UpdateOrderStatusHistoryDto,
    user?: AuthenticatedUser,
  ) {
    const history = await this.ensureStatusHistoryExists(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== history.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing status history record is not supported.',
      );
    }

    const organizationId = history.organizationId;

    if (payload.orderId) {
      const order = await this.ensureOrderExists(payload.orderId, user);

      if (order.organizationId !== organizationId) {
        throw new BadRequestException(
          'Status history organization must match the parent order.',
        );
      }
    }

    if (payload.changedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.changedByStaffId,
        organizationId,
      );
    }

    return this.prisma.orderStatusHistory.update({
      where: { id },
      data: payload,
    });
  }

  async removeStatusHistory(id: string, user?: AuthenticatedUser) {
    await this.ensureStatusHistoryExists(id, user);
    return this.prisma.orderStatusHistory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async findApprovals(user: AuthenticatedUser, orderId?: string) {
    if (orderId) {
      await this.ensureOrderExists(orderId, user);
    }

    return this.prisma.orderApproval.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderId ? { orderId } : {}),
      },
      include: {
        order: true,
        requestedByStaff: true,
        approvedByStaff: true,
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });
  }

  async createApproval(
    payload: CreateOrderApprovalDto,
    user?: AuthenticatedUser,
  ) {
    const order = await this.ensureOrderExists(payload.orderId, user);

    if (order.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Approval organization must match the parent order.',
      );
    }

    await this.ensureStaffBelongsToOrganization(
      payload.requestedByStaffId,
      payload.organizationId,
    );

    if (payload.approvedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.approvedByStaffId,
        payload.organizationId,
      );
    }

    this.validateApprovalDecision(
      payload.status ?? ApprovalStatus.pending,
      payload.approvedByStaffId,
      payload.decisionNote,
    );

    const approvalStatus = payload.status ?? ApprovalStatus.pending;

    if (approvalStatus === ApprovalStatus.pending) {
      await this.ensureNoDuplicatePendingApproval(
        payload.orderId,
        payload.approvalTypeCode,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const approval = await tx.orderApproval.create({
        data: {
          ...payload,
          status: approvalStatus,
        },
      });

      await this.applyApprovalOutcomeToOrder(tx, {
        order,
        approvalTypeCode: payload.approvalTypeCode,
        approvalStatus,
        changedByStaffId:
          payload.approvedByStaffId ?? payload.requestedByStaffId,
      });

      return approval;
    });
  }

  async updateApproval(
    id: string,
    payload: UpdateOrderApprovalDto,
    user?: AuthenticatedUser,
  ) {
    const approval = await this.ensureApprovalExists(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== approval.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing approval is not supported. Create a new approval in the target organization instead.',
      );
    }

    const organizationId = approval.organizationId;

    if (payload.orderId) {
      const order = await this.ensureOrderExists(payload.orderId, user);

      if (order.organizationId !== organizationId) {
        throw new BadRequestException(
          'Approval organization must match the parent order.',
        );
      }
    }

    if (payload.requestedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.requestedByStaffId,
        organizationId,
      );
    }

    if (payload.approvedByStaffId) {
      await this.ensureStaffBelongsToOrganization(
        payload.approvedByStaffId,
        organizationId,
      );
    }

    const nextStatus = payload.status ?? approval.status;
    const approvedByStaffId =
      payload.approvedByStaffId === undefined
        ? approval.approvedByStaffId
        : payload.approvedByStaffId;
    const decisionNote =
      payload.decisionNote === undefined
        ? approval.decisionNote
        : payload.decisionNote;
    this.validateApprovalDecision(nextStatus, approvedByStaffId, decisionNote);

    if (
      nextStatus === ApprovalStatus.pending &&
      (payload.approvalTypeCode ?? approval.approvalTypeCode)
    ) {
      await this.ensureNoDuplicatePendingApproval(
        approval.orderId,
        payload.approvalTypeCode ?? approval.approvalTypeCode,
        id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.orderApproval.update({
        where: { id },
        data: {
          ...payload,
          decidedAt:
            payload.status &&
            payload.status !== ApprovalStatus.pending &&
            payload.status !== ApprovalStatus.cancelled
              ? new Date()
              : undefined,
        },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id: approval.orderId },
      });

      await this.applyApprovalOutcomeToOrder(tx, {
        order,
        approvalTypeCode: payload.approvalTypeCode ?? approval.approvalTypeCode,
        approvalStatus: nextStatus,
        changedByStaffId: approvedByStaffId ?? approval.requestedByStaffId,
      });

      return updatedApproval;
    });
  }

  async removeApproval(id: string, user?: AuthenticatedUser) {
    await this.ensureApprovalExists(id, user);
    return this.prisma.orderApproval.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async findFinancials(user: AuthenticatedUser, orderId?: string) {
    if (orderId) {
      await this.ensureOrderExists(orderId, user);
    }

    return this.prisma.orderFinancial.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderId ? { orderId } : {}),
      },
      include: {
        order: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createFinancial(
    payload: CreateOrderFinancialDto,
    user?: AuthenticatedUser,
  ) {
    const order = await this.ensureOrderExists(payload.orderId, user);

    if (order.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Financial organization must match the parent order.',
      );
    }

    this.validateFinancialTotals(payload);

    return this.prisma.orderFinancial.create({
      data: payload,
    });
  }

  async updateFinancial(
    id: string,
    payload: UpdateOrderFinancialDto,
    user?: AuthenticatedUser,
  ) {
    const financial = await this.ensureFinancialExists(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== financial.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing financial record is not supported. Create a new financial record in the target organization instead.',
      );
    }

    const candidate = {
      orderId: payload.orderId ?? financial.orderId,
      organizationId: payload.organizationId ?? financial.organizationId,
      subtotalLaborAmount:
        payload.subtotalLaborAmount ?? Number(financial.subtotalLaborAmount),
      subtotalPartsAmount:
        payload.subtotalPartsAmount ?? Number(financial.subtotalPartsAmount),
      discountAmount:
        payload.discountAmount ?? Number(financial.discountAmount),
      taxAmount: payload.taxAmount ?? Number(financial.taxAmount),
      grandTotalAmount:
        payload.grandTotalAmount ?? Number(financial.grandTotalAmount),
      paidTotalAmount:
        payload.paidTotalAmount ?? Number(financial.paidTotalAmount),
      balanceDueAmount:
        payload.balanceDueAmount ?? Number(financial.balanceDueAmount),
    };

    const order = await this.ensureOrderExists(candidate.orderId, user);
    if (order.organizationId !== candidate.organizationId) {
      throw new BadRequestException(
        'Financial organization must match the parent order.',
      );
    }

    this.validateFinancialTotals(candidate);

    return this.prisma.orderFinancial.update({
      where: { id },
      data: payload,
    });
  }

  async removeFinancial(id: string, user?: AuthenticatedUser) {
    await this.ensureFinancialExists(id, user);
    return this.prisma.orderFinancial.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async validateOrderRelations(
    payload: {
      organizationId: string;
      branchId: string;
      clientId: string;
      assetId: string;
      createdByStaffId: string;
      assignedManagerId?: string;
    },
    user?: AuthenticatedUser,
  ) {
    if (user) {
      this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    }

    await this.ensureOrganizationExists(payload.organizationId);

    const [branch, client, asset] = await Promise.all([
      this.ensureBranchExists(payload.branchId),
      this.ensureClientExists(payload.clientId),
      this.ensureAssetExists(payload.assetId),
    ]);

    if (branch.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Branch does not belong to the selected organization.',
      );
    }

    if (client.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Client does not belong to the selected organization.',
      );
    }

    if (asset.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Asset does not belong to the selected organization.',
      );
    }

    if (asset.clientId !== payload.clientId) {
      throw new BadRequestException(
        'Selected asset does not belong to the selected client.',
      );
    }

    await this.ensureStaffBelongsToOrganization(
      payload.createdByStaffId,
      payload.organizationId,
    );

    if (payload.assignedManagerId) {
      await this.ensureStaffBelongsToOrganization(
        payload.assignedManagerId,
        payload.organizationId,
      );
    }
  }

  private async ensureStatusRequirements(
    orderId: string,
    nextStatus: OrderStatus,
  ) {
    if (nextStatus === OrderStatus.completed) {
      const [totalTasks, blockingTasks] = await Promise.all([
        this.prisma.orderTask.count({
          where: {
            orderId,
            deletedAt: null,
          },
        }),
        this.prisma.orderTask.count({
          where: {
            orderId,
            deletedAt: null,
            status: {
              notIn: [TaskStatus.completed, TaskStatus.cancelled],
            },
          },
        }),
      ]);

      if (totalTasks === 0) {
        throw new BadRequestException(
          'Order cannot be completed before at least one task is created.',
        );
      }

      if (blockingTasks > 0) {
        throw new BadRequestException(
          'Order cannot be completed while there are unfinished tasks.',
        );
      }
    }

    if (nextStatus === OrderStatus.delivered) {
      const [order, financial] = await Promise.all([
        this.ensureOrderExists(orderId),
        this.prisma.orderFinancial.findFirst({
          where: {
            orderId,
            deletedAt: null,
          },
        }),
      ]);

      if (order.status !== OrderStatus.completed) {
        throw new BadRequestException(
          'Only completed orders can be delivered.',
        );
      }

      if (!financial) {
        throw new BadRequestException('Order financial record not found.');
      }

      if (Number(financial.balanceDueAmount) > 0.01) {
        throw new BadRequestException(
          'Order cannot be delivered while there is an unpaid balance.',
        );
      }
    }
  }

  private ensureValidOrderTransition(
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
  ) {
    if (fromStatus === toStatus) {
      return;
    }

    const allowedTargets = ALLOWED_ORDER_TRANSITIONS[fromStatus];

    if (!allowedTargets.includes(toStatus)) {
      throw new BadRequestException(
        `Order status cannot move from ${fromStatus} to ${toStatus}.`,
      );
    }
  }

  private validateFinancialTotals(payload: {
    subtotalLaborAmount: number;
    subtotalPartsAmount: number;
    discountAmount: number;
    taxAmount: number;
    grandTotalAmount: number;
    paidTotalAmount: number;
    balanceDueAmount: number;
  }) {
    const expectedGrandTotal =
      payload.subtotalLaborAmount +
      payload.subtotalPartsAmount -
      payload.discountAmount +
      payload.taxAmount;
    const expectedBalance = payload.grandTotalAmount - payload.paidTotalAmount;

    if (
      payload.discountAmount >
      payload.subtotalLaborAmount + payload.subtotalPartsAmount
    ) {
      throw new BadRequestException(
        'Discount amount cannot exceed labor and parts subtotal.',
      );
    }

    if (payload.paidTotalAmount > payload.grandTotalAmount) {
      throw new BadRequestException(
        'Paid amount cannot be greater than grand total.',
      );
    }

    if (Math.abs(expectedGrandTotal - payload.grandTotalAmount) > 0.01) {
      throw new BadRequestException(
        'Grand total amount does not match the calculated financial totals.',
      );
    }

    if (Math.abs(expectedBalance - payload.balanceDueAmount) > 0.01) {
      throw new BadRequestException(
        'Balance due amount does not match grand total minus paid total.',
      );
    }
  }

  private async syncOrderFinancialFromTasks(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const [tasks, financial] = await Promise.all([
      tx.orderTask.findMany({
        where: {
          orderId,
          deletedAt: null,
        },
        select: {
          estimatedLaborAmount: true,
        },
      }),
      tx.orderFinancial.findFirst({
        where: {
          orderId,
          deletedAt: null,
        },
      }),
    ]);

    if (!financial) {
      return;
    }

    const subtotalLaborAmount = tasks.reduce(
      (sum, task) => sum + Number(task.estimatedLaborAmount ?? 0),
      0,
    );
    const subtotalPartsAmount = Number(financial.subtotalPartsAmount);
    const discountAmount = Number(financial.discountAmount);
    const taxAmount = Number(financial.taxAmount);
    const paidTotalAmount = Number(financial.paidTotalAmount);
    const grandTotalAmount =
      subtotalLaborAmount + subtotalPartsAmount - discountAmount + taxAmount;
    const balanceDueAmount = grandTotalAmount - paidTotalAmount;

    await tx.orderFinancial.update({
      where: { id: financial.id },
      data: {
        subtotalLaborAmount: new Prisma.Decimal(subtotalLaborAmount),
        grandTotalAmount: new Prisma.Decimal(grandTotalAmount),
        balanceDueAmount: new Prisma.Decimal(balanceDueAmount),
      },
    });
  }

  private async ensureUniqueTaskLine(
    orderId: string,
    lineNo: number,
    excludingTaskId?: string,
  ) {
    const existingTask = await this.prisma.orderTask.findFirst({
      where: {
        orderId,
        lineNo,
        deletedAt: null,
        ...(excludingTaskId ? { id: { not: excludingTaskId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingTask) {
      throw new BadRequestException(
        'This line number is already used in the selected order.',
      );
    }
  }

  private async generateOrderNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `ORD-${yy}${mm}${dd}-`;

    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${organizationId}),
        hashtext(${prefix})
      )
    `;

    const existingOrders = await tx.order.findMany({
      where: {
        organizationId,
        orderNumber: {
          startsWith: prefix,
        },
      },
      select: {
        orderNumber: true,
      },
    });

    const maxSequence = existingOrders.reduce((maxValue, order) => {
      const rawSequence = order.orderNumber.slice(prefix.length);
      if (!/^\d+$/.test(rawSequence)) {
        return maxValue;
      }

      return Math.max(maxValue, Number(rawSequence));
    }, 0);

    const sequence = String(maxSequence + 1).padStart(3, '0');

    return `${prefix}${sequence}`;
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

  private async ensureClientExists(id: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  private async ensureAssetExists(id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    return asset;
  }

  private async ensureStaffBelongsToOrganization(
    staffId: string,
    organizationId: string,
  ) {
    const staffMember = await this.prisma.staffMember.findFirst({
      where: {
        id: staffId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!staffMember) {
      throw new BadRequestException(
        'Selected staff member does not belong to the selected organization.',
      );
    }

    return staffMember;
  }

  private async ensureServiceCategoryExists(
    id: string,
    user?: AuthenticatedUser,
  ) {
    const category = await this.prisma.serviceCategory.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Service category not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, category.organizationId);
    }

    return category;
  }

  private async ensureServiceExists(id: string, user?: AuthenticatedUser) {
    const service = await this.prisma.service.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, service.organizationId);
    }

    return service;
  }

  private async ensureOrderExists(id: string, user?: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, order.organizationId);
    }

    return order;
  }

  private async ensureOrderTaskExists(id: string, user?: AuthenticatedUser) {
    const task = await this.prisma.orderTask.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!task) {
      throw new NotFoundException('Order task not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, task.organizationId);
    }

    return task;
  }

  private validateAssignmentStatusConsistency(
    status: OrderAssignmentStatus,
    acceptedByStaffId?: string | null,
  ) {
    if (
      (status === OrderAssignmentStatus.accepted ||
        status === OrderAssignmentStatus.completed) &&
      !acceptedByStaffId
    ) {
      throw new BadRequestException(
        'Accepted or completed assignments must include acceptedByStaffId.',
      );
    }
  }

  private validateApprovalDecision(
    status: ApprovalStatus,
    approvedByStaffId?: string | null,
    decisionNote?: string | null,
  ) {
    if (
      (status === ApprovalStatus.approved ||
        status === ApprovalStatus.rejected) &&
      !approvedByStaffId
    ) {
      throw new BadRequestException(
        'Approved or rejected decisions must include approvedByStaffId.',
      );
    }

    if (status === ApprovalStatus.rejected && !decisionNote?.trim()) {
      throw new BadRequestException(
        'Rejected approvals must include a decision note.',
      );
    }
  }

  private async applyApprovalOutcomeToOrder(
    tx: Prisma.TransactionClient,
    payload: {
      order: {
        id: string;
        organizationId: string;
        status: OrderStatus;
      };
      approvalTypeCode?: string | null;
      approvalStatus: ApprovalStatus;
      changedByStaffId?: string | null;
    },
  ) {
    if (payload.approvalStatus !== ApprovalStatus.approved) {
      return;
    }

    const nextStatus = this.getOrderStatusFromApprovalType(
      payload.approvalTypeCode,
    );

    if (!nextStatus || nextStatus === payload.order.status) {
      return;
    }

    this.ensureValidOrderTransition(payload.order.status, nextStatus);
    await this.ensureStatusRequirements(payload.order.id, nextStatus);

    await tx.orderStatusHistory.create({
      data: {
        organizationId: payload.order.organizationId,
        orderId: payload.order.id,
        fromStatus: payload.order.status,
        toStatus: nextStatus,
        changedByStaffId: payload.changedByStaffId ?? undefined,
        note: `Approval auto-transition: ${payload.approvalTypeCode ?? 'approval'}`,
        customerVisible: false,
      },
    });

    await tx.order.update({
      where: { id: payload.order.id },
      data: {
        status: nextStatus,
        deliveredAt:
          nextStatus === OrderStatus.delivered ? new Date() : undefined,
      },
    });
  }

  private getOrderStatusFromApprovalType(approvalTypeCode?: string | null) {
    switch (approvalTypeCode) {
      case 'estimate':
        return OrderStatus.approved;
      case 'work_start':
        return OrderStatus.in_progress;
      case 'parts_purchase':
        return OrderStatus.waiting_parts;
      case 'delivery':
        return OrderStatus.delivered;
      default:
        return null;
    }
  }

  private async syncTaskWithAssignment(
    tx: Prisma.TransactionClient,
    orderTaskId: string,
    payload: {
      toStaffId: string;
      status: OrderAssignmentStatus;
    },
  ) {
    const taskUpdate: Prisma.OrderTaskUpdateInput = {
      assignedStaff: {
        connect: { id: payload.toStaffId },
      },
    };

    if (payload.status === OrderAssignmentStatus.accepted) {
      taskUpdate.status = TaskStatus.in_progress;
      taskUpdate.startedAt = new Date();
    }

    if (payload.status === OrderAssignmentStatus.completed) {
      taskUpdate.status = TaskStatus.completed;
      taskUpdate.completedAt = new Date();
      taskUpdate.startedAt = new Date();
    }

    await tx.orderTask.update({
      where: { id: orderTaskId },
      data: taskUpdate,
    });
  }

  private ensureTaskCanBeUpdatedByUser(
    user: AuthenticatedUser | undefined,
    task: {
      organizationId: string;
      assignedStaffId: string | null;
    },
    payload: UpdateOrderTaskDto,
  ) {
    if (
      !user ||
      user.isPlatformAdmin ||
      this.userHasPermission(user, 'order.update')
    ) {
      return;
    }

    if (!this.userHasPermission(user, 'task.update')) {
      throw new ForbiddenException(
        'You do not have permission to update this task.',
      );
    }

    const forbiddenFields: Array<keyof UpdateOrderTaskDto> = [
      'organizationId',
      'orderId',
      'lineNo',
      'serviceId',
      'title',
      'assignedStaffId',
      'estimatedLaborAmount',
    ];

    const hasRestrictedChanges = forbiddenFields.some(
      (field) => payload[field] !== undefined,
    );

    if (hasRestrictedChanges) {
      throw new ForbiddenException(
        'Workers can only update their own task progress fields.',
      );
    }

    if (
      !user.staffMemberId ||
      user.organizationId !== task.organizationId ||
      task.assignedStaffId !== user.staffMemberId
    ) {
      throw new ForbiddenException(
        'You can only update tasks assigned to you.',
      );
    }
  }

  private userHasPermission(user: AuthenticatedUser, permissionCode: string) {
    return user.permissionCodes.includes(permissionCode);
  }

  private ensureOrderUpdatePayloadIsAllowed(
    user: AuthenticatedUser | undefined,
    payload: UpdateOrderDto,
  ) {
    if (
      !user ||
      user.isPlatformAdmin ||
      this.userHasPermission(user, 'order.update') ||
      this.userHasPermission(user, 'order.approve')
    ) {
      return;
    }

    if (!this.userHasPermission(user, 'payment.create')) {
      throw new ForbiddenException(
        'You do not have permission to update this order.',
      );
    }

    const {
      payment,
      status,
      organizationId,
      branchId,
      clientId,
      assetId,
      createdByStaffId,
      assignedManagerId,
      orderNumber,
      customerRequestText,
      intakeNotes,
      internalDiagnosisText,
      priority,
    } = payload;

    const hasRestrictedFields = [
      organizationId,
      branchId,
      clientId,
      assetId,
      createdByStaffId,
      assignedManagerId,
      orderNumber,
      customerRequestText,
      intakeNotes,
      internalDiagnosisText,
      priority,
    ].some((value) => value !== undefined);

    if (hasRestrictedFields) {
      throw new ForbiddenException(
        'Payment operators can only record settlement updates on an order.',
      );
    }

    if (status !== undefined && status !== OrderStatus.delivered) {
      throw new ForbiddenException(
        'Payment operators can only mark an order as delivered.',
      );
    }

    if (
      payment &&
      [payment.cash, payment.card].some(
        (amount) => amount !== undefined && amount < 0,
      )
    ) {
      throw new ForbiddenException('Payment amounts cannot be negative.');
    }
  }

  private async ensureNoDuplicatePendingApproval(
    orderId: string,
    approvalTypeCode?: string | null,
    excludingApprovalId?: string,
  ) {
    if (!approvalTypeCode?.trim()) {
      return;
    }

    const existingApproval = await this.prisma.orderApproval.findFirst({
      where: {
        orderId,
        approvalTypeCode,
        status: ApprovalStatus.pending,
        deletedAt: null,
        ...(excludingApprovalId ? { id: { not: excludingApprovalId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingApproval) {
      throw new BadRequestException(
        'This order already has a pending approval of the same type.',
      );
    }
  }

  private async resolveCurrentStaffMemberId(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser | undefined,
    organizationId: string,
  ) {
    if (!user || user.isPlatformAdmin || !user.staffMemberId) {
      return undefined;
    }

    if (user.organizationId !== organizationId) {
      return undefined;
    }

    const staffMember = await tx.staffMember.findFirst({
      where: {
        id: user.staffMemberId,
        organizationId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    return staffMember?.id;
  }

  private async ensureAssignmentExists(id: string, user?: AuthenticatedUser) {
    const assignment = await this.prisma.orderAssignment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, assignment.organizationId);
    }

    return assignment;
  }

  private async ensureStatusHistoryExists(
    id: string,
    user?: AuthenticatedUser,
  ) {
    const history = await this.prisma.orderStatusHistory.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!history) {
      throw new NotFoundException('Order status history record not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, history.organizationId);
    }

    return history;
  }

  private async ensureApprovalExists(id: string, user?: AuthenticatedUser) {
    const approval = await this.prisma.orderApproval.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!approval) {
      throw new NotFoundException('Order approval not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, approval.organizationId);
    }

    return approval;
  }

  private async ensureFinancialExists(id: string, user?: AuthenticatedUser) {
    const financial = await this.prisma.orderFinancial.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!financial) {
      throw new NotFoundException('Order financial record not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, financial.organizationId);
    }

    return financial;
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
    user: AuthenticatedUser,
    organizationId: string,
  ) {
    if (
      !user.isPlatformAdmin &&
      !user.organizationIds.includes(organizationId)
    ) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
  }
}
