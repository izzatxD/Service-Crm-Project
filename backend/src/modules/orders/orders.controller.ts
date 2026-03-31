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
import { OrdersService } from './orders.service';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('service-categories')
  @RequirePermissions('order.read')
  findServiceCategories(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findServiceCategories(
      request.user,
      organizationId,
    );
  }

  @Post('service-categories')
  @RequirePermissions('order.create')
  createServiceCategory(
    @Body() payload: CreateServiceCategoryDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createServiceCategory(payload, request.user);
  }

  @Patch('service-categories/:id')
  @RequirePermissions('order.update')
  updateServiceCategory(
    @Param('id') id: string,
    @Body() payload: UpdateServiceCategoryDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateServiceCategory(id, payload, request.user);
  }

  @Delete('service-categories/:id')
  @RequirePermissions('order.update')
  removeServiceCategory(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeServiceCategory(id, request.user);
  }

  @Get('services')
  @RequirePermissions('order.read')
  findServices(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findServices(request.user, organizationId);
  }

  @Post('services')
  @RequirePermissions('order.create')
  createService(
    @Body() payload: CreateServiceDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createService(payload, request.user);
  }

  @Patch('services/:id')
  @RequirePermissions('order.update')
  updateService(
    @Param('id') id: string,
    @Body() payload: UpdateServiceDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateService(id, payload, request.user);
  }

  @Delete('services/:id')
  @RequirePermissions('order.update')
  removeService(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeService(id, request.user);
  }

  @Get('orders')
  @RequirePermissions('order.read')
  findOrders(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findOrders(request.user, organizationId);
  }

  @Get('orders/:id')
  @RequirePermissions('order.read')
  findOrderById(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findOrderById(id, request.user);
  }

  @Post('orders')
  @RequirePermissions('order.create')
  createOrder(
    @Body() payload: CreateOrderDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createOrder(payload, request.user);
  }

  @Post('orders/workflow')
  @RequirePermissions('order.create')
  createOrderWorkflow(
    @Body() payload: CreateOrderWorkflowDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createOrderWorkflow(payload, request.user);
  }

  @Patch('orders/:id')
  @RequireAnyPermission('order.update', 'order.approve', 'payment.create')
  updateOrder(
    @Param('id') id: string,
    @Body() payload: UpdateOrderDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateOrder(id, payload, request.user);
  }

  @Delete('orders/:id')
  @RequirePermissions('order.update')
  removeOrder(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeOrder(id, request.user);
  }

  @Get('order-tasks')
  @RequirePermissions('order.read')
  findOrderTasks(
    @Query('orderId') orderId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findOrderTasks(request.user, orderId);
  }

  @Post('order-tasks')
  @RequireAnyPermission('order.update', 'order.approve')
  createOrderTask(
    @Body() payload: CreateOrderTaskDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createOrderTask(payload, request.user);
  }

  @Patch('order-tasks/:id')
  @RequirePermissions('task.update')
  updateOrderTask(
    @Param('id') id: string,
    @Body() payload: UpdateOrderTaskDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateOrderTask(id, payload, request.user);
  }

  @Delete('order-tasks/:id')
  @RequirePermissions('order.update')
  removeOrderTask(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeOrderTask(id, request.user);
  }

  @Get('order-assignments')
  @RequirePermissions('order.read')
  findAssignments(
    @Query('orderId') orderId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findAssignments(request.user, orderId);
  }

  @Post('order-assignments')
  @RequirePermissions('order.assign')
  createAssignment(
    @Body() payload: CreateOrderAssignmentDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createAssignment(payload, request.user);
  }

  @Patch('order-assignments/:id')
  @RequirePermissions('order.assign')
  updateAssignment(
    @Param('id') id: string,
    @Body() payload: UpdateOrderAssignmentDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateAssignment(id, payload, request.user);
  }

  @Delete('order-assignments/:id')
  @RequirePermissions('order.assign')
  removeAssignment(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeAssignment(id, request.user);
  }

  @Get('order-status-history')
  @RequirePermissions('order.read')
  findStatusHistory(
    @Query('orderId') orderId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findStatusHistory(request.user, orderId);
  }

  @Post('order-status-history')
  @RequirePermissions('order.update')
  createStatusHistory(
    @Body() payload: CreateOrderStatusHistoryDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createStatusHistory(payload, request.user);
  }

  @Patch('order-status-history/:id')
  @RequirePermissions('order.update')
  updateStatusHistory(
    @Param('id') id: string,
    @Body() payload: UpdateOrderStatusHistoryDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateStatusHistory(id, payload, request.user);
  }

  @Delete('order-status-history/:id')
  @RequirePermissions('order.update')
  removeStatusHistory(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeStatusHistory(id, request.user);
  }

  @Get('order-approvals')
  @RequirePermissions('order.read')
  findApprovals(
    @Query('orderId') orderId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findApprovals(request.user, orderId);
  }

  @Post('order-approvals')
  @RequirePermissions('order.approve')
  createApproval(
    @Body() payload: CreateOrderApprovalDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createApproval(payload, request.user);
  }

  @Patch('order-approvals/:id')
  @RequirePermissions('order.approve')
  updateApproval(
    @Param('id') id: string,
    @Body() payload: UpdateOrderApprovalDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateApproval(id, payload, request.user);
  }

  @Delete('order-approvals/:id')
  @RequirePermissions('order.approve')
  removeApproval(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeApproval(id, request.user);
  }

  @Get('order-financials')
  @RequirePermissions('order.read')
  findFinancials(
    @Query('orderId') orderId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.findFinancials(request.user, orderId);
  }

  @Post('order-financials')
  @RequirePermissions('order.update')
  createFinancial(
    @Body() payload: CreateOrderFinancialDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.createFinancial(payload, request.user);
  }

  @Patch('order-financials/:id')
  @RequireAnyPermission('order.update', 'order.approve')
  updateFinancial(
    @Param('id') id: string,
    @Body() payload: UpdateOrderFinancialDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.updateFinancial(id, payload, request.user);
  }

  @Delete('order-financials/:id')
  @RequirePermissions('order.update')
  removeFinancial(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.ordersService.removeFinancial(id, request.user);
  }
}
