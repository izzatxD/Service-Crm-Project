import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStockDocumentLineDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  stockDocumentId: string;

  @ApiProperty()
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  unitCostAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
