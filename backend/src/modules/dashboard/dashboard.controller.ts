import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AccessGuard } from '../auth/access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions('report.read')
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiOkResponse({
    schema: {
      example: {
        scope: {
          organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          branchId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        },
        orders: {
          total: 128,
          today: 7,
          active: 19,
          completed: 84,
          cancelled: 3,
          byStatus: [
            { status: 'new', count: 4 },
            { status: 'in_progress', count: 11 },
            { status: 'completed', count: 84 },
          ],
        },
        finance: {
          grandTotal: 42500000,
          paidTotal: 31800000,
          balanceDue: 10700000,
          laborTotal: 18500000,
          partsTotal: 24000000,
          todayPayments: 2200000,
          expensesTotal: 6400000,
          overdueBalanceOrders: 17,
          topDebtors: [
            {
              id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
              orderNumber: 'ORD-1001',
              status: 'in_progress',
              clientName: 'Aziz Karimov',
              assetName: 'Cobalt 4',
              paidTotalAmount: 1200000,
              balanceDueAmount: 1800000,
            },
          ],
        },
        inventory: {
          outOfStockItems: 6,
        },
        generatedAt: '2026-03-26T12:00:00.000Z',
      },
    },
  })
  getSummary(
    @Query('organizationId') organizationId: string,
    @Query('branchId') branchId?: string,
    @Req() request?: Request & { user: AuthenticatedUser },
  ) {
    return this.dashboardService.getSummary(
      request?.user,
      organizationId,
      branchId,
    );
  }
}
