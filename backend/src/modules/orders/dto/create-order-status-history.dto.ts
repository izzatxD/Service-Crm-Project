import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateOrderStatusHistoryDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  fromStatus?: OrderStatus;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  toStatus: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  changedByStaffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  customerVisible?: boolean;
}
