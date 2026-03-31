import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty()
  @IsUUID()
  expenseCategoryId: string;

  @ApiProperty()
  @IsString()
  @Length(2, 255)
  title: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdByStaffId?: string;

  @ApiProperty()
  @IsDateString()
  expenseDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
