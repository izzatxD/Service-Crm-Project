import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { StaffRole } from '@prisma/client';
import { CreateStaffAccountDto } from './create-staff-account.dto';

export class CreateStaffMemberDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Legacy global user link. Ignored by the organization-scoped staff auth flow.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Legacy alias for account.loginIdentifier.',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Legacy profile field kept only for request compatibility during rollout.',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Legacy alias for account.password.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Legacy alias for account.telegramUserId.',
  })
  @IsOptional()
  @IsString()
  telegramUserId?: string;

  @ApiPropertyOptional({ type: () => CreateStaffAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStaffAccountDto)
  account?: CreateStaffAccountDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  fullName: string;

  @ApiProperty({ enum: StaffRole })
  @IsEnum(StaffRole)
  primaryRole: StaffRole;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hiredAt?: string;
}
