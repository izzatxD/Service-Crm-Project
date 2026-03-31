import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodCode } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({ enum: PaymentMethodCode })
  @IsEnum(PaymentMethodCode)
  paymentMethodCode: PaymentMethodCode;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
