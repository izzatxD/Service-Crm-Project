import { PartialType } from '@nestjs/swagger';

import { CreateOrderStatusHistoryDto } from './create-order-status-history.dto';

export class UpdateOrderStatusHistoryDto extends PartialType(
  CreateOrderStatusHistoryDto,
) {}
