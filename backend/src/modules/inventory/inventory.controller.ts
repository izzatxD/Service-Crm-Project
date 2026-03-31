import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { AccessGuard } from '../auth/access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { RequireAnyPermission } from '../auth/require-any-permission.decorator';
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
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('inventory-items')
  @RequireAnyPermission(
    'inventory.read',
    'order.approve',
    'order.update',
    'order.create',
  )
  findInventoryItems(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.findInventoryItems(
      request.user,
      organizationId,
    );
  }

  @Post('inventory-items')
  @RequirePermissions('inventory.adjust')
  createInventoryItem(
    @Body() payload: CreateInventoryItemDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.createInventoryItem(payload, request.user);
  }

  @Patch('inventory-items/:id')
  @RequirePermissions('inventory.adjust')
  updateInventoryItem(
    @Param('id') id: string,
    @Body() payload: UpdateInventoryItemDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.updateInventoryItem(id, payload, request.user);
  }

  @Delete('inventory-items/:id')
  @RequirePermissions('inventory.adjust')
  removeInventoryItem(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.removeInventoryItem(id, request.user);
  }

  @Get('inventory-stocks')
  @RequirePermissions('inventory.read')
  findInventoryStocks(
    @Query('branchId') branchId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.findInventoryStocks(request.user, branchId);
  }

  @Post('inventory-stocks')
  @RequirePermissions('inventory.adjust')
  createInventoryStock(
    @Body() payload: CreateInventoryStockDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.createInventoryStock(payload, request.user);
  }

  @Patch('inventory-stocks/:id')
  @RequirePermissions('inventory.adjust')
  updateInventoryStock(
    @Param('id') id: string,
    @Body() payload: UpdateInventoryStockDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.updateInventoryStock(
      id,
      payload,
      request.user,
    );
  }

  @Delete('inventory-stocks/:id')
  @RequirePermissions('inventory.adjust')
  removeInventoryStock(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.removeInventoryStock(id, request.user);
  }

  @Get('stock-documents')
  @RequirePermissions('inventory.read')
  findStockDocuments(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.findStockDocuments(
      request.user,
      organizationId,
    );
  }

  @Post('stock-documents')
  @RequirePermissions('inventory.adjust')
  createStockDocument(
    @Body() payload: CreateStockDocumentDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.createStockDocument(payload, request.user);
  }

  @Patch('stock-documents/:id')
  @RequirePermissions('inventory.adjust')
  updateStockDocument(
    @Param('id') id: string,
    @Body() payload: UpdateStockDocumentDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.updateStockDocument(id, payload, request.user);
  }

  @Delete('stock-documents/:id')
  @RequirePermissions('inventory.adjust')
  removeStockDocument(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.removeStockDocument(id, request.user);
  }

  @Get('stock-document-lines')
  @RequirePermissions('inventory.read')
  findStockDocumentLines(
    @Query('stockDocumentId') stockDocumentId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.findStockDocumentLines(
      request.user,
      stockDocumentId,
    );
  }

  @Post('stock-document-lines')
  @RequirePermissions('inventory.adjust')
  createStockDocumentLine(
    @Body() payload: CreateStockDocumentLineDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.createStockDocumentLine(payload, request.user);
  }

  @Patch('stock-document-lines/:id')
  @RequirePermissions('inventory.adjust')
  updateStockDocumentLine(
    @Param('id') id: string,
    @Body() payload: UpdateStockDocumentLineDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.updateStockDocumentLine(
      id,
      payload,
      request.user,
    );
  }

  @Delete('stock-document-lines/:id')
  @RequirePermissions('inventory.adjust')
  removeStockDocumentLine(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.removeStockDocumentLine(id, request.user);
  }

  @Get('stock-movements')
  @RequirePermissions('inventory.read')
  findStockMovements(
    @Query('branchId') branchId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.findStockMovements(request.user, branchId);
  }

  @Post('stock-movements')
  @RequirePermissions('inventory.adjust')
  createStockMovement(
    @Body() payload: CreateStockMovementDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.createStockMovement(payload, request.user);
  }

  @Patch('stock-movements/:id')
  @RequirePermissions('inventory.adjust')
  updateStockMovement(
    @Param('id') id: string,
    @Body() payload: UpdateStockMovementDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.updateStockMovement(id, payload, request.user);
  }

  @Delete('stock-movements/:id')
  @RequirePermissions('inventory.adjust')
  removeStockMovement(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.removeStockMovement(id, request.user);
  }

  @Get('planned-parts')
  @RequirePermissions('inventory.read')
  findPlannedParts(
    @Query('orderTaskId') orderTaskId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.findPlannedParts(request.user, orderTaskId);
  }

  @Post('planned-parts')
  @RequirePermissions('inventory.adjust')
  createPlannedPart(
    @Body() payload: CreatePlannedPartDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.createPlannedPart(payload, request.user);
  }

  @Patch('planned-parts/:id')
  @RequirePermissions('inventory.adjust')
  updatePlannedPart(
    @Param('id') id: string,
    @Body() payload: UpdatePlannedPartDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.updatePlannedPart(id, payload, request.user);
  }

  @Delete('planned-parts/:id')
  @RequirePermissions('inventory.adjust')
  removePlannedPart(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.removePlannedPart(id, request.user);
  }

  @Get('order-task-parts')
  @RequireAnyPermission(
    'inventory.read',
    'order.read',
    'order.approve',
    'order.update',
    'order.create',
  )
  findOrderTaskParts(
    @Query('orderTaskId') orderTaskId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.findOrderTaskParts(request.user, orderTaskId);
  }

  @Post('order-task-parts')
  @RequireAnyPermission('inventory.adjust', 'order.approve', 'order.update')
  createOrderTaskPart(
    @Body() payload: CreateOrderTaskPartDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.createOrderTaskPart(payload, request.user);
  }

  @Patch('order-task-parts/:id')
  @RequirePermissions('inventory.adjust')
  updateOrderTaskPart(
    @Param('id') id: string,
    @Body() payload: UpdateOrderTaskPartDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.updateOrderTaskPart(id, payload, request.user);
  }

  @Delete('order-task-parts/:id')
  @RequirePermissions('inventory.adjust')
  removeOrderTaskPart(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inventoryService.removeOrderTaskPart(id, request.user);
  }
}
