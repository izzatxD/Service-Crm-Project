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
import { PlatformAdminOnly } from '../auth/platform-admin-only.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequirePermissions('staff.read')
  findAllOrganizations(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.organizationsService.findAllOrganizations(request.user);
  }

  @Get(':id')
  @RequirePermissions('staff.read')
  findOrganizationById(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.organizationsService.findOrganizationById(id, request.user);
  }

  @Post()
  @PlatformAdminOnly()
  createOrganization(@Body() payload: CreateOrganizationDto) {
    return this.organizationsService.createOrganization(payload);
  }

  @Patch(':id')
  @PlatformAdminOnly()
  updateOrganization(
    @Param('id') id: string,
    @Body() payload: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(id, payload);
  }

  @Delete(':id')
  @PlatformAdminOnly()
  removeOrganization(@Param('id') id: string) {
    return this.organizationsService.removeOrganization(id);
  }
}

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequirePermissions('staff.read')
  findBranches(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.organizationsService.findBranches(request.user, organizationId);
  }

  @Get(':id')
  @RequirePermissions('staff.read')
  findBranchById(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.organizationsService.findBranchById(id, request.user);
  }

  @Post()
  @RequirePermissions('system.settings')
  createBranch(
    @Body() payload: CreateBranchDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.organizationsService.createBranch(payload, request.user);
  }

  @Patch(':id')
  @RequirePermissions('system.settings')
  updateBranch(
    @Param('id') id: string,
    @Body() payload: UpdateBranchDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.organizationsService.updateBranch(id, payload, request.user);
  }

  @Delete(':id')
  @RequirePermissions('system.settings')
  removeBranch(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.organizationsService.removeBranch(id, request.user);
  }
}
