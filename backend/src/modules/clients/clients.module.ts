import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import {
  AssetsController,
  ClientsController,
  VehicleProfilesController,
} from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClientsController, AssetsController, VehicleProfilesController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
