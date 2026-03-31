import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodCode } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: PaymentMethodCode })
  @IsEnum(PaymentMethodCode)
  paymentMethodCode: PaymentMethodCode;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty()
  @IsDateString()
  paidAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  receivedByStaffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
