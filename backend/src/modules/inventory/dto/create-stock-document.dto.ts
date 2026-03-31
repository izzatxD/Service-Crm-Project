import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockDocumentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateStockDocumentDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ enum: StockDocumentType })
  @IsEnum(StockDocumentType)
  documentType: StockDocumentType;

  @ApiProperty()
  @IsString()
  @Length(2, 64)
  documentNumber: string;

  @ApiProperty()
  @IsDateString()
  documentDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceBranchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  destinationBranchId?: string;

  @ApiProperty()
  @IsUUID()
  createdByStaffId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
