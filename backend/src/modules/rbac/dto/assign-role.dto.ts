import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  staffMemberId: string;

  @ApiProperty()
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedByStaffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
