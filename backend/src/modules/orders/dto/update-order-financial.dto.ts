import { PartialType } from '@nestjs/swagger';

import { CreateOrderFinancialDto } from './create-order-financial.dto';

export class UpdateOrderFinancialDto extends PartialType(
  CreateOrderFinancialDto,
) {}
