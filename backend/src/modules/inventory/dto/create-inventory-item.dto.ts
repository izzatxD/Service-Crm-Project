import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryItemType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({ enum: InventoryItemType })
  @IsEnum(InventoryItemType)
  itemTypeCode: InventoryItemType;

  @ApiProperty()
  @IsString()
  @Length(2, 255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ default: 'pcs' })
  @IsOptional()
  @IsString()
  unitName?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
