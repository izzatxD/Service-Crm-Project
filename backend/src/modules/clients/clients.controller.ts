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
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateVehicleProfileDto } from './dto/create-vehicle-profile.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateVehicleProfileDto } from './dto/update-vehicle-profile.dto';
import { ClientsService } from './clients.service';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('order.read')
  findClients(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.findClients(request.user, organizationId);
  }

  @Get(':id')
  @RequirePermissions('order.read')
  findClientById(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.findClientById(id, request.user);
  }

  @Post()
  @RequirePermissions('order.create')
  createClient(
    @Body() payload: CreateClientDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.createClient(payload, request.user);
  }

  @Patch(':id')
  @RequirePermissions('order.update')
  updateClient(
    @Param('id') id: string,
    @Body() payload: UpdateClientDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.updateClient(id, payload, request.user);
  }

  @Delete(':id')
  @RequirePermissions('order.update')
  removeClient(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.removeClient(id, request.user);
  }
}

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('order.read')
  findAssets(
    @Query('organizationId') organizationId: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.findAssets(
      request.user,
      organizationId,
      clientId,
    );
  }

  @Get(':id')
  @RequirePermissions('order.read')
  findAssetById(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.findAssetById(id, request.user);
  }

  @Post()
  @RequirePermissions('order.create')
  createAsset(
    @Body() payload: CreateAssetDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.createAsset(payload, request.user);
  }

  @Patch(':id')
  @RequirePermissions('order.update')
  updateAsset(
    @Param('id') id: string,
    @Body() payload: UpdateAssetDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.updateAsset(id, payload, request.user);
  }

  @Delete(':id')
  @RequirePermissions('order.update')
  removeAsset(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.removeAsset(id, request.user);
  }
}

@ApiTags('vehicle-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('vehicle-profiles')
export class VehicleProfilesController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('order.read')
  findVehicleProfiles(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.findVehicleProfiles(
      request.user,
      organizationId,
    );
  }

  @Get(':id')
  @RequirePermissions('order.read')
  findVehicleProfileById(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.findVehicleProfileById(id, request.user);
  }

  @Post()
  @RequirePermissions('order.create')
  createVehicleProfile(
    @Body() payload: CreateVehicleProfileDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.createVehicleProfile(payload, request.user);
  }

  @Patch(':id')
  @RequirePermissions('order.update')
  updateVehicleProfile(
    @Param('id') id: string,
    @Body() payload: UpdateVehicleProfileDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.updateVehicleProfile(id, payload, request.user);
  }

  @Delete(':id')
  @RequirePermissions('order.update')
  removeVehicleProfile(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.clientsService.removeVehicleProfile(id, request.user);
  }
}
