import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { StaffModule } from './modules/staff/staff.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [appConfig],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ClientsModule,
    DashboardModule,
    FinanceModule,
    InventoryModule,
    OrganizationsModule,
    OrdersModule,
    StaffModule,
    RbacModule,
  ],
})
export class AppModule {}
