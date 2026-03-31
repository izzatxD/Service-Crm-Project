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
import { CreateStaffAccountDto } from './dto/create-staff-account.dto';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { LinkStaffAccountTelegramDto } from './dto/link-staff-account-telegram.dto';
import { ResetStaffAccountPasswordDto } from './dto/reset-staff-account-password.dto';
import { UpdateStaffAccountDto } from './dto/update-staff-account.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { StaffService } from './staff.service';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequirePermissions('staff.read')
  findAll(
    @Query('organizationId') organizationId: string | undefined,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.findAll(request.user, organizationId);
  }

  @Get(':id')
  @RequirePermissions('staff.read')
  findOne(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.findOne(id, request.user);
  }

  @Get(':id/profile')
  @RequirePermissions('staff.read')
  findProfile(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.findProfile(id, request.user);
  }

  @Post()
  @RequirePermissions('staff.manage')
  create(
    @Body() payload: CreateStaffMemberDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.create(payload, request.user);
  }

  @Patch(':id')
  @RequirePermissions('staff.manage')
  update(
    @Param('id') id: string,
    @Body() payload: UpdateStaffMemberDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.update(id, payload, request.user);
  }

  @Post(':id/account')
  @RequirePermissions('staff.manage')
  createAccount(
    @Param('id') id: string,
    @Body() payload: CreateStaffAccountDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.createAccount(id, payload, request.user);
  }

  @Patch(':id/account')
  @RequirePermissions('staff.manage')
  updateAccount(
    @Param('id') id: string,
    @Body() payload: UpdateStaffAccountDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.updateAccount(id, payload, request.user);
  }

  @Post(':id/account/reset-password')
  @RequirePermissions('staff.manage')
  resetAccountPassword(
    @Param('id') id: string,
    @Body() payload: ResetStaffAccountPasswordDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.resetAccountPassword(id, payload, request.user);
  }

  @Post(':id/account/telegram')
  @RequirePermissions('staff.manage')
  linkTelegram(
    @Param('id') id: string,
    @Body() payload: LinkStaffAccountTelegramDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.linkTelegram(id, payload, request.user);
  }

  @Delete(':id/account/telegram')
  @RequirePermissions('staff.manage')
  unlinkTelegram(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.unlinkTelegram(id, request.user);
  }

  @Delete(':id')
  @RequirePermissions('staff.manage')
  remove(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.staffService.remove(id, request.user);
  }
}
