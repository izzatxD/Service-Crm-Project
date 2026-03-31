import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateOrderTaskDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty()
  @Min(1)
  lineNo: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty()
  @IsString()
  @Length(2, 255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedStaffId?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.pending })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedLaborAmount?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualLaborAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
