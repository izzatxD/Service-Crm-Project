import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderAssignmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrderAssignmentDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderTaskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromStaffId?: string;

  @ApiProperty()
  @IsUUID()
  toStaffId: string;

  @ApiProperty()
  @IsUUID()
  assignedByStaffId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  acceptedByStaffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignmentTypeCode?: string;

  @ApiPropertyOptional({
    enum: OrderAssignmentStatus,
    default: OrderAssignmentStatus.assigned,
  })
  @IsOptional()
  @IsEnum(OrderAssignmentStatus)
  status?: OrderAssignmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
