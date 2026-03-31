import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderPriority, OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? undefined : value;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ example: 'ORD-260326-001' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsString()
  @Length(2, 64)
  orderNumber?: string;

  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiProperty()
  @IsUUID()
  assetId: string;

  @ApiProperty()
  @IsUUID()
  createdByStaffId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedManagerId?: string;

  @ApiPropertyOptional({ enum: OrderStatus, default: OrderStatus.new })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderPriority, default: OrderPriority.normal })
  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerRequestText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intakeNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalDiagnosisText?: string;
}
