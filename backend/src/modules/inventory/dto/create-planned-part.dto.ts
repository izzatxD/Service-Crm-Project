import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlannedPartStatus } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePlannedPartDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  orderTaskId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({
    enum: PlannedPartStatus,
    default: PlannedPartStatus.planned,
  })
  @IsOptional()
  @IsEnum(PlannedPartStatus)
  status?: PlannedPartStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
