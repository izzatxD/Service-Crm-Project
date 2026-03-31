import { PartialType } from '@nestjs/swagger';

import { CreateOrderTaskPartDto } from './create-order-task-part.dto';

export class UpdateOrderTaskPartDto extends PartialType(
  CreateOrderTaskPartDto,
) {}
