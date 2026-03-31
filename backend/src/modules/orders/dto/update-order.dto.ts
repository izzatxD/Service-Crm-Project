import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, ValidateNested } from 'class-validator';

import { CreateOrderDto } from './create-order.dto';

export class OrderPaymentSettleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cash?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  card?: number;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiPropertyOptional({ type: OrderPaymentSettleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderPaymentSettleDto)
  payment?: OrderPaymentSettleDto;
}
