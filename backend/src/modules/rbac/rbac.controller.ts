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
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RbacService } from './rbac.service';

@ApiTags('rbac')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('staff.read')
  findRoles(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.findRoles(request.user, organizationId);
  }

  @Get('roles/:id')
  @RequirePermissions('staff.read')
  findRoleById(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.findRoleById(id, request.user);
  }

  @Post('roles')
  @RequirePermissions('system.settings')
  createRole(
    @Body() payload: CreateRoleDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.createRole(payload, request.user);
  }

  @Patch('roles/:id')
  @RequirePermissions('system.settings')
  updateRole(
    @Param('id') id: string,
    @Body() payload: UpdateRoleDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.updateRole(id, payload, request.user);
  }

  @Delete('roles/:id')
  @RequirePermissions('system.settings')
  removeRole(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.removeRole(id, request.user);
  }

  @Get('permissions')
  @RequirePermissions('staff.read')
  findPermissions() {
    return this.rbacService.findPermissions();
  }

  @Get('permissions/:id')
  @RequirePermissions('staff.read')
  findPermissionById(@Param('id') id: string) {
    return this.rbacService.findPermissionById(id);
  }

  @Post('permissions')
  @PlatformAdminOnly()
  createPermission(@Body() payload: CreatePermissionDto) {
    return this.rbacService.createPermission(payload);
  }

  @Patch('permissions/:id')
  @PlatformAdminOnly()
  updatePermission(
    @Param('id') id: string,
    @Body() payload: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(id, payload);
  }

  @Delete('permissions/:id')
  @PlatformAdminOnly()
  removePermission(@Param('id') id: string) {
    return this.rbacService.removePermission(id);
  }

  @Get('assignments')
  @RequirePermissions('staff.read')
  findAssignments(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.findAssignments(request.user, organizationId);
  }

  @Post('assignments')
  @RequirePermissions('staff.manage')
  assignRole(
    @Body() payload: AssignRoleDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.assignRole(payload, request.user);
  }

  @Delete('assignments/:id')
  @RequirePermissions('staff.manage')
  removeAssignment(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.rbacService.removeAssignment(id, request.user);
  }
}
