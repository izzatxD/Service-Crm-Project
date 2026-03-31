import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateOrderFinancialDto {
  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  subtotalLaborAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  subtotalPartsAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  discountAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  taxAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  grandTotalAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  paidTotalAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  balanceDueAmount: number;
}
