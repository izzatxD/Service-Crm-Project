import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { CreateStaffMemberDto } from './create-staff-member.dto';
import { UpdateStaffAccountDto } from './update-staff-account.dto';

export class UpdateStaffMemberDto extends PartialType(CreateStaffMemberDto) {
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

  @ApiPropertyOptional({ type: () => UpdateStaffAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateStaffAccountDto)
  account?: UpdateStaffAccountDto;
}
