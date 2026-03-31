import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateStockMovementDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  movementType: StockMovementType;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCostAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stockDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty()
  @IsUUID()
  createdByStaffId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
