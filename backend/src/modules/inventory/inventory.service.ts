import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateInventoryStockDto } from './dto/create-inventory-stock.dto';
import { CreateOrderTaskPartDto } from './dto/create-order-task-part.dto';
import { CreatePlannedPartDto } from './dto/create-planned-part.dto';
import { CreateStockDocumentDto } from './dto/create-stock-document.dto';
import { CreateStockDocumentLineDto } from './dto/create-stock-document-line.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { UpdateInventoryStockDto } from './dto/update-inventory-stock.dto';
import { UpdateOrderTaskPartDto } from './dto/update-order-task-part.dto';
import { UpdatePlannedPartDto } from './dto/update-planned-part.dto';
import { UpdateStockDocumentDto } from './dto/update-stock-document.dto';
import { UpdateStockDocumentLineDto } from './dto/update-stock-document-line.dto';
import { UpdateStockMovementDto } from './dto/update-stock-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  findInventoryItems(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.inventoryItem.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createInventoryItem(
    payload: CreateInventoryItemDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    await this.ensureOrganizationExists(payload.organizationId);
    return this.prisma.inventoryItem.create({ data: payload });
  }

  async updateInventoryItem(
    id: string,
    payload: UpdateInventoryItemDto,
    user?: AuthenticatedUser,
  ) {
    const item = await this.ensureInventoryItemExists(id);
    this.ensureUserHasOrganizationAccess(user, item.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== item.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing inventory item is not supported.',
      );
    }

    return this.prisma.inventoryItem.update({
      where: { id },
      data: payload,
    });
  }

  async removeInventoryItem(id: string, user?: AuthenticatedUser) {
    const item = await this.ensureInventoryItemExists(id);
    this.ensureUserHasOrganizationAccess(user, item.organizationId);

    return this.prisma.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findInventoryStocks(user: AuthenticatedUser, branchId?: string) {
    if (branchId) {
      const branch = await this.ensureBranchExists(branchId);
      this.ensureUserHasOrganizationAccess(user, branch.organizationId);
    }

    return this.prisma.inventoryStock.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        inventoryItem: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createInventoryStock(
    payload: CreateInventoryStockDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    await this.ensureOrganizationExists(payload.organizationId);
    await this.ensureBranchBelongsToOrganization(
      payload.branchId,
      payload.organizationId,
    );
    await this.ensureInventoryItemBelongsToOrganization(
      payload.inventoryItemId,
      payload.organizationId,
    );

    return this.prisma.inventoryStock.create({ data: payload });
  }

  async updateInventoryStock(
    id: string,
    payload: UpdateInventoryStockDto,
    user?: AuthenticatedUser,
  ) {
    const stock = await this.ensureInventoryStockExists(id);
    this.ensureUserHasOrganizationAccess(user, stock.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== stock.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing inventory stock is not supported.',
      );
    }

    if (payload.organizationId) {
      await this.ensureOrganizationExists(payload.organizationId);
    }

    if (payload.branchId) {
      await this.ensureBranchBelongsToOrganization(
        payload.branchId,
        payload.organizationId ?? stock.organizationId,
      );
    }

    if (payload.inventoryItemId) {
      await this.ensureInventoryItemBelongsToOrganization(
        payload.inventoryItemId,
        payload.organizationId ?? stock.organizationId,
      );
    }

    return this.prisma.inventoryStock.update({
      where: { id },
      data: payload,
    });
  }

  async removeInventoryStock(id: string, user?: AuthenticatedUser) {
    const stock = await this.ensureInventoryStockExists(id);
    this.ensureUserHasOrganizationAccess(user, stock.organizationId);

    return this.prisma.inventoryStock.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  findStockDocuments(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.stockDocument.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      include: {
        branch: true,
        sourceBranch: true,
        destinationBranch: true,
        createdByStaff: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  createStockDocument(
    payload: CreateStockDocumentDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    return this.prisma.stockDocument.create({
      data: {
        ...payload,
        documentDate: new Date(payload.documentDate),
      },
    });
  }

  async updateStockDocument(
    id: string,
    payload: UpdateStockDocumentDto,
    user?: AuthenticatedUser,
  ) {
    const stockDocument = await this.ensureStockDocumentExists(id);
    this.ensureUserHasOrganizationAccess(user, stockDocument.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== stockDocument.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing stock document is not supported.',
      );
    }

    return this.prisma.stockDocument.update({
      where: { id },
      data: {
        ...payload,
        documentDate: payload.documentDate
          ? new Date(payload.documentDate)
          : undefined,
      },
    });
  }

  async removeStockDocument(id: string, user?: AuthenticatedUser) {
    const stockDocument = await this.ensureStockDocumentExists(id);
    this.ensureUserHasOrganizationAccess(user, stockDocument.organizationId);

    return this.prisma.stockDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findStockDocumentLines(
    user: AuthenticatedUser,
    stockDocumentId?: string,
  ) {
    if (stockDocumentId) {
      const stockDocument =
        await this.ensureStockDocumentExists(stockDocumentId);
      this.ensureUserHasOrganizationAccess(user, stockDocument.organizationId);
    }

    return this.prisma.stockDocumentLine.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(stockDocumentId ? { stockDocumentId } : {}),
      },
      include: {
        stockDocument: true,
        inventoryItem: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createStockDocumentLine(
    payload: CreateStockDocumentLineDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    return this.prisma.stockDocumentLine.create({ data: payload });
  }

  async updateStockDocumentLine(
    id: string,
    payload: UpdateStockDocumentLineDto,
    user?: AuthenticatedUser,
  ) {
    const line = await this.ensureStockDocumentLineExists(id);
    this.ensureUserHasOrganizationAccess(user, line.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== line.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing stock document line is not supported.',
      );
    }

    return this.prisma.stockDocumentLine.update({
      where: { id },
      data: payload,
    });
  }

  async removeStockDocumentLine(id: string, user?: AuthenticatedUser) {
    const line = await this.ensureStockDocumentLineExists(id);
    this.ensureUserHasOrganizationAccess(user, line.organizationId);

    return this.prisma.stockDocumentLine.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findStockMovements(user: AuthenticatedUser, branchId?: string) {
    if (branchId) {
      const branch = await this.ensureBranchExists(branchId);
      this.ensureUserHasOrganizationAccess(user, branch.organizationId);
    }

    return this.prisma.stockMovement.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        inventoryItem: true,
        stockDocument: true,
        createdByStaff: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async createStockMovement(
    payload: CreateStockMovementDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    await this.validateStockMovementPayload(payload);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureInventoryStockRow(
        tx,
        payload.organizationId,
        payload.branchId,
        payload.inventoryItemId,
      );
      const movement = await tx.stockMovement.create({ data: payload });
      await this.applyStockDelta(
        tx,
        payload.organizationId,
        payload.branchId,
        payload.inventoryItemId,
      );
      return movement;
    });
  }

  async updateStockMovement(
    id: string,
    payload: UpdateStockMovementDto,
    user?: AuthenticatedUser,
  ) {
    const existingMovement = await this.ensureStockMovementExists(id);
    this.ensureUserHasOrganizationAccess(user, existingMovement.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== existingMovement.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing stock movement is not supported.',
      );
    }

    const mergedPayload = {
      organizationId: payload.organizationId ?? existingMovement.organizationId,
      inventoryItemId:
        payload.inventoryItemId ?? existingMovement.inventoryItemId,
      branchId: payload.branchId ?? existingMovement.branchId,
      movementType: payload.movementType ?? existingMovement.movementType,
      quantity: payload.quantity ?? Number(existingMovement.quantity),
      unitCostAmount:
        payload.unitCostAmount ?? Number(existingMovement.unitCostAmount),
      stockDocumentId:
        payload.stockDocumentId === undefined
          ? (existingMovement.stockDocumentId ?? undefined)
          : (payload.stockDocumentId ?? undefined),
      createdByStaffId:
        payload.createdByStaffId ?? existingMovement.createdByStaffId,
      referenceType:
        payload.referenceType === undefined
          ? (existingMovement.referenceType ?? undefined)
          : (payload.referenceType ?? undefined),
      referenceId:
        payload.referenceId === undefined
          ? (existingMovement.referenceId ?? undefined)
          : (payload.referenceId ?? undefined),
      note:
        payload.note === undefined
          ? (existingMovement.note ?? undefined)
          : (payload.note ?? undefined),
    };

    await this.validateStockMovementPayload(mergedPayload);

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.update({
        where: { id },
        data: payload,
      });

      await this.applyStockDelta(
        tx,
        mergedPayload.organizationId,
        mergedPayload.branchId,
        mergedPayload.inventoryItemId,
      );

      if (
        existingMovement.branchId !== mergedPayload.branchId ||
        existingMovement.inventoryItemId !== mergedPayload.inventoryItemId
      ) {
        await this.applyStockDelta(
          tx,
          existingMovement.organizationId,
          existingMovement.branchId,
          existingMovement.inventoryItemId,
        );
      }

      return movement;
    });
  }

  async removeStockMovement(id: string, user?: AuthenticatedUser) {
    const movement = await this.ensureStockMovementExists(id);
    this.ensureUserHasOrganizationAccess(user, movement.organizationId);

    return this.prisma.$transaction(async (tx) => {
      const removedMovement = await tx.stockMovement.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await this.applyStockDelta(
        tx,
        movement.organizationId,
        movement.branchId,
        movement.inventoryItemId,
      );

      return removedMovement;
    });
  }

  async findPlannedParts(user: AuthenticatedUser, orderTaskId?: string) {
    if (orderTaskId) {
      const orderTask = await this.ensureOrderTaskExists(orderTaskId);
      this.ensureUserHasOrganizationAccess(user, orderTask.organizationId);
    }

    return this.prisma.plannedPart.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderTaskId ? { orderTaskId } : {}),
      },
      include: {
        orderTask: true,
        inventoryItem: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  createPlannedPart(payload: CreatePlannedPartDto, user?: AuthenticatedUser) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    return this.prisma.plannedPart.create({ data: payload });
  }

  async updatePlannedPart(
    id: string,
    payload: UpdatePlannedPartDto,
    user?: AuthenticatedUser,
  ) {
    const plannedPart = await this.ensurePlannedPartExists(id);
    this.ensureUserHasOrganizationAccess(user, plannedPart.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== plannedPart.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing planned part is not supported.',
      );
    }

    return this.prisma.plannedPart.update({
      where: { id },
      data: payload,
    });
  }

  async removePlannedPart(id: string, user?: AuthenticatedUser) {
    const plannedPart = await this.ensurePlannedPartExists(id);
    this.ensureUserHasOrganizationAccess(user, plannedPart.organizationId);

    return this.prisma.plannedPart.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findOrderTaskParts(user: AuthenticatedUser, orderTaskId?: string) {
    if (orderTaskId) {
      const orderTask = await this.ensureOrderTaskExists(orderTaskId);
      this.ensureUserHasOrganizationAccess(user, orderTask.organizationId);
    }

    return this.prisma.orderTaskPart.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user),
        ...(orderTaskId ? { orderTaskId } : {}),
      },
      include: {
        orderTask: true,
        inventoryItem: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createOrderTaskPart(
    payload: CreateOrderTaskPartDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    const task = await this.ensureOrderTaskBelongsToOrganization(
      payload.orderTaskId,
      payload.organizationId,
    );
    const item = await this.ensureInventoryItemBelongsToOrganization(
      payload.inventoryItemId,
      payload.organizationId,
    );

    const order = await this.ensureOrderExists(task.orderId);
    const stock = await this.ensureInventoryStockForBranchAndItem(
      order.branchId,
      payload.inventoryItemId,
    );

    this.ensureEnoughStock(stock.quantityOnHand, payload.quantity);

    return this.prisma.$transaction(async (tx) => {
      const part = await tx.orderTaskPart.create({ data: payload });

      await this.applyStockUsageForOrderTaskPart(
        tx,
        order.branchId,
        payload.inventoryItemId,
        item.organizationId,
      );
      await this.syncOrderFinancialFromParts(tx, task.orderId);

      return part;
    });
  }

  async updateOrderTaskPart(
    id: string,
    payload: UpdateOrderTaskPartDto,
    user?: AuthenticatedUser,
  ) {
    const existingPart = await this.ensureOrderTaskPartExists(id);
    this.ensureUserHasOrganizationAccess(user, existingPart.organizationId);

    if (
      payload.organizationId &&
      payload.organizationId !== existingPart.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing order task part is not supported.',
      );
    }

    const task = await this.ensureOrderTaskExists(
      payload.orderTaskId ?? existingPart.orderTaskId,
    );
    const organizationId =
      payload.organizationId ?? existingPart.organizationId;
    const inventoryItemId =
      payload.inventoryItemId ?? existingPart.inventoryItemId;
    const order = await this.ensureOrderExists(task.orderId);

    await this.ensureOrderTaskBelongsToOrganization(task.id, organizationId);
    await this.ensureInventoryItemBelongsToOrganization(
      inventoryItemId,
      organizationId,
    );

    return this.prisma.$transaction(async (tx) => {
      const part = await tx.orderTaskPart.update({
        where: { id },
        data: payload,
      });

      await this.applyStockUsageForOrderTaskPart(
        tx,
        order.branchId,
        inventoryItemId,
        organizationId,
      );
      await this.syncOrderFinancialFromParts(tx, task.orderId);

      if (
        existingPart.inventoryItemId !== inventoryItemId ||
        existingPart.orderTaskId !== task.id
      ) {
        const previousTask = await tx.orderTask.findUniqueOrThrow({
          where: { id: existingPart.orderTaskId },
          select: { orderId: true },
        });
        const previousOrder = await tx.order.findUniqueOrThrow({
          where: { id: previousTask.orderId },
          select: { branchId: true },
        });

        await this.applyStockUsageForOrderTaskPart(
          tx,
          previousOrder.branchId,
          existingPart.inventoryItemId,
          existingPart.organizationId,
        );
        await this.syncOrderFinancialFromParts(tx, previousTask.orderId);
      }

      return part;
    });
  }

  async removeOrderTaskPart(id: string, user?: AuthenticatedUser) {
    const existingPart = await this.ensureOrderTaskPartExists(id);
    this.ensureUserHasOrganizationAccess(user, existingPart.organizationId);
    const task = await this.ensureOrderTaskExists(existingPart.orderTaskId);
    const order = await this.ensureOrderExists(task.orderId);

    return this.prisma.$transaction(async (tx) => {
      const removedPart = await tx.orderTaskPart.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await this.applyStockUsageForOrderTaskPart(
        tx,
        order.branchId,
        existingPart.inventoryItemId,
        existingPart.organizationId,
      );
      await this.syncOrderFinancialFromParts(tx, task.orderId);

      return removedPart;
    });
  }

  private async validateStockMovementPayload(payload: {
    organizationId: string;
    inventoryItemId: string;
    branchId: string;
    movementType: StockMovementType;
    quantity: number;
    createdByStaffId: string;
    stockDocumentId?: string;
  }) {
    if (payload.quantity <= 0) {
      throw new BadRequestException(
        'Stock movement quantity must be greater than zero.',
      );
    }

    await this.ensureOrganizationExists(payload.organizationId);
    await this.ensureBranchBelongsToOrganization(
      payload.branchId,
      payload.organizationId,
    );
    await this.ensureInventoryItemBelongsToOrganization(
      payload.inventoryItemId,
      payload.organizationId,
    );
    await this.ensureStaffBelongsToOrganization(
      payload.createdByStaffId,
      payload.organizationId,
    );

    if (payload.stockDocumentId) {
      const stockDocument = await this.ensureStockDocumentExists(
        payload.stockDocumentId,
      );
      if (stockDocument.organizationId !== payload.organizationId) {
        throw new BadRequestException(
          'Stock document does not belong to the selected organization.',
        );
      }
    }
  }

  private async applyStockDelta(
    tx: Prisma.TransactionClient,
    organizationId: string,
    branchId: string,
    inventoryItemId: string,
  ) {
    const stock = await this.ensureInventoryStockRow(
      tx,
      organizationId,
      branchId,
      inventoryItemId,
    );

    const signedTotal = await this.calculateSignedMovementTotal(
      tx,
      branchId,
      inventoryItemId,
    );
    if (signedTotal.lessThan(0)) {
      throw new BadRequestException(
        'Stock cannot become negative after this movement.',
      );
    }

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        quantityOnHand: signedTotal,
      },
    });
  }

  private async calculateSignedMovementTotal(
    tx: Prisma.TransactionClient,
    branchId: string,
    inventoryItemId: string,
  ) {
    const movements = await tx.stockMovement.findMany({
      where: {
        branchId,
        inventoryItemId,
        deletedAt: null,
      },
      select: {
        movementType: true,
        quantity: true,
      },
    });

    return movements.reduce((sum, movement) => {
      const sign = this.isOutboundMovement(movement.movementType) ? -1 : 1;
      return sum.plus(movement.quantity.mul(sign));
    }, new Prisma.Decimal(0));
  }

  private isOutboundMovement(movementType: StockMovementType) {
    return (
      movementType === StockMovementType.usage ||
      movementType === StockMovementType.transfer_out ||
      movementType === StockMovementType.return_out
    );
  }

  private async applyStockUsageForOrderTaskPart(
    tx: Prisma.TransactionClient,
    branchId: string,
    inventoryItemId: string,
    organizationId: string,
  ) {
    const stock = await tx.inventoryStock.findFirst({
      where: {
        branchId,
        inventoryItemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!stock) {
      throw new BadRequestException(
        'Inventory stock row is missing for the selected branch and item.',
      );
    }

    const partAggregate = await tx.orderTaskPart.aggregate({
      where: {
        organizationId,
        inventoryItemId,
        deletedAt: null,
        orderTask: {
          order: {
            branchId,
            deletedAt: null,
          },
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const usedQuantity = partAggregate._sum.quantity ?? new Prisma.Decimal(0);
    const movementSignedTotal = await this.calculateSignedMovementTotal(
      tx,
      branchId,
      inventoryItemId,
    );
    const availableQuantity = movementSignedTotal.minus(usedQuantity);

    if (availableQuantity.lessThan(0)) {
      throw new BadRequestException(
        'Not enough stock for the selected part quantity.',
      );
    }

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        quantityOnHand: availableQuantity,
      },
    });
  }

  private async syncOrderFinancialFromParts(
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

    const taskParts = await tx.orderTaskPart.findMany({
      where: {
        deletedAt: null,
        orderTask: {
          orderId,
          deletedAt: null,
        },
      },
      select: {
        quantity: true,
        unitPriceAmount: true,
      },
    });

    const subtotalPartsAmount = taskParts.reduce((sum, part) => {
      return sum.plus(part.unitPriceAmount.mul(part.quantity));
    }, new Prisma.Decimal(0));

    const grandTotalAmount = new Prisma.Decimal(financial.subtotalLaborAmount)
      .plus(subtotalPartsAmount)
      .minus(financial.discountAmount)
      .plus(financial.taxAmount);

    const balanceDueAmount = grandTotalAmount.minus(financial.paidTotalAmount);

    await tx.orderFinancial.update({
      where: { id: financial.id },
      data: {
        subtotalPartsAmount,
        grandTotalAmount,
        balanceDueAmount: balanceDueAmount.greaterThan(0)
          ? balanceDueAmount
          : new Prisma.Decimal(0),
      },
    });
  }

  private ensureEnoughStock(
    quantityOnHand: Prisma.Decimal,
    requiredQuantity: number,
  ) {
    if (quantityOnHand.lessThan(new Prisma.Decimal(requiredQuantity))) {
      throw new BadRequestException(
        'Not enough stock for the selected part quantity.',
      );
    }
  }

  private async ensureOrganizationExists(id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    return organization;
  }

  private async ensureBranchExists(id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found.');
    }

    return branch;
  }

  private async ensureBranchBelongsToOrganization(
    branchId: string,
    organizationId: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        'Branch does not belong to the selected organization.',
      );
    }

    return branch;
  }

  private async ensureInventoryItemBelongsToOrganization(
    inventoryItemId: string,
    organizationId: string,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, organizationId, deletedAt: null },
    });

    if (!item) {
      throw new BadRequestException(
        'Inventory item does not belong to the selected organization.',
      );
    }

    return item;
  }

  private async ensureInventoryItemExists(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }

    return item;
  }

  private async ensureInventoryStockExists(id: string) {
    const stock = await this.prisma.inventoryStock.findFirst({
      where: { id, deletedAt: null },
    });

    if (!stock) {
      throw new NotFoundException('Inventory stock not found.');
    }

    return stock;
  }

  private async ensureInventoryStockForBranchAndItem(
    branchId: string,
    inventoryItemId: string,
  ) {
    const stock = await this.prisma.inventoryStock.findFirst({
      where: {
        branchId,
        inventoryItemId,
        deletedAt: null,
      },
    });

    if (!stock) {
      throw new BadRequestException(
        'Inventory stock row is missing for the selected branch and item.',
      );
    }

    return stock;
  }

  private async ensureInventoryStockRow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    branchId: string,
    inventoryItemId: string,
  ) {
    const stock = await tx.inventoryStock.findFirst({
      where: {
        organizationId,
        branchId,
        inventoryItemId,
        deletedAt: null,
      },
    });

    if (stock) {
      return stock;
    }

    return tx.inventoryStock.create({
      data: {
        organizationId,
        branchId,
        inventoryItemId,
        quantityOnHand: new Prisma.Decimal(0),
        reorderLevel: new Prisma.Decimal(0),
      },
    });
  }

  private async ensureStaffBelongsToOrganization(
    staffId: string,
    organizationId: string,
  ) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new BadRequestException(
        'Selected staff member does not belong to the selected organization.',
      );
    }

    return staff;
  }

  private async ensureStockDocumentExists(id: string) {
    const document = await this.prisma.stockDocument.findFirst({
      where: { id, deletedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Stock document not found.');
    }

    return document;
  }

  private async ensureStockDocumentLineExists(id: string) {
    const line = await this.prisma.stockDocumentLine.findFirst({
      where: { id, deletedAt: null },
    });

    if (!line) {
      throw new NotFoundException('Stock document line not found.');
    }

    return line;
  }

  private async ensureStockMovementExists(id: string) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, deletedAt: null },
    });

    if (!movement) {
      throw new NotFoundException('Stock movement not found.');
    }

    return movement;
  }

  private async ensureOrderTaskBelongsToOrganization(
    orderTaskId: string,
    organizationId: string,
  ) {
    const task = await this.prisma.orderTask.findFirst({
      where: { id: orderTaskId, organizationId, deletedAt: null },
    });

    if (!task) {
      throw new BadRequestException(
        'Order task does not belong to the selected organization.',
      );
    }

    return task;
  }

  private async ensureOrderTaskExists(id: string) {
    const task = await this.prisma.orderTask.findFirst({
      where: { id, deletedAt: null },
    });

    if (!task) {
      throw new NotFoundException('Order task not found.');
    }

    return task;
  }

  private async ensureOrderExists(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }

  private async ensureOrderTaskPartExists(id: string) {
    const part = await this.prisma.orderTaskPart.findFirst({
      where: { id, deletedAt: null },
    });

    if (!part) {
      throw new NotFoundException('Order task part not found.');
    }

    return part;
  }

  private async ensurePlannedPartExists(id: string) {
    const part = await this.prisma.plannedPart.findFirst({
      where: { id, deletedAt: null },
    });

    if (!part) {
      throw new NotFoundException('Planned part not found.');
    }

    return part;
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
