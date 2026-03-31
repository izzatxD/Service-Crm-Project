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
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller()
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('payment-methods')
  @RequirePermissions('payment.read')
  findPaymentMethods(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.findPaymentMethods(request.user, organizationId);
  }

  @Post('payment-methods')
  @RequirePermissions('system.settings')
  createPaymentMethod(
    @Body() payload: CreatePaymentMethodDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.createPaymentMethod(payload, request.user);
  }

  @Patch('payment-methods/:id')
  @RequirePermissions('system.settings')
  updatePaymentMethod(
    @Param('id') id: string,
    @Body() payload: UpdatePaymentMethodDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.updatePaymentMethod(id, payload, request.user);
  }

  @Delete('payment-methods/:id')
  @RequirePermissions('system.settings')
  removePaymentMethod(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.removePaymentMethod(id, request.user);
  }

  @Get('payments')
  @RequirePermissions('payment.read')
  findPayments(
    @Query('orderId') orderId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.findPayments(request.user, orderId);
  }

  @Post('payments')
  @RequirePermissions('payment.create')
  createPayment(
    @Body() payload: CreatePaymentDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.createPayment(payload, request.user);
  }

  @Patch('payments/:id')
  @RequirePermissions('payment.create')
  updatePayment(
    @Param('id') id: string,
    @Body() payload: UpdatePaymentDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.updatePayment(id, payload, request.user);
  }

  @Delete('payments/:id')
  @RequirePermissions('payment.create')
  removePayment(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.removePayment(id, request.user);
  }

  @Get('expense-categories')
  @RequirePermissions('expense.create')
  findExpenseCategories(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.findExpenseCategories(
      request.user,
      organizationId,
    );
  }

  @Post('expense-categories')
  @RequirePermissions('expense.create')
  createExpenseCategory(
    @Body() payload: CreateExpenseCategoryDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.createExpenseCategory(payload, request.user);
  }

  @Patch('expense-categories/:id')
  @RequirePermissions('expense.create')
  updateExpenseCategory(
    @Param('id') id: string,
    @Body() payload: UpdateExpenseCategoryDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.updateExpenseCategory(id, payload, request.user);
  }

  @Delete('expense-categories/:id')
  @RequirePermissions('expense.create')
  removeExpenseCategory(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.removeExpenseCategory(id, request.user);
  }

  @Get('expenses')
  @RequirePermissions('expense.create')
  findExpenses(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.findExpenses(request.user, organizationId);
  }

  @Post('expenses')
  @RequirePermissions('expense.create')
  createExpense(
    @Body() payload: CreateExpenseDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.createExpense(payload, request.user);
  }

  @Patch('expenses/:id')
  @RequirePermissions('expense.create')
  updateExpense(
    @Param('id') id: string,
    @Body() payload: UpdateExpenseDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.updateExpense(id, payload, request.user);
  }

  @Delete('expenses/:id')
  @RequirePermissions('expense.create')
  removeExpense(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.financeService.removeExpense(id, request.user);
  }
}
