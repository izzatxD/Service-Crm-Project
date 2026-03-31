import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrderApprovalDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty()
  @IsUUID()
  requestedByStaffId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approvedByStaffId?: string;

  @ApiPropertyOptional({
    enum: ApprovalStatus,
    default: ApprovalStatus.pending,
  })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalTypeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionNote?: string;
}
