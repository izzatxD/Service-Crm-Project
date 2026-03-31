import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import {
  BranchesController,
  OrganizationsController,
} from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController, BranchesController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
