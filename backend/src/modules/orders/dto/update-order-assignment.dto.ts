import { PartialType } from '@nestjs/swagger';

import { CreateOrderAssignmentDto } from './create-order-assignment.dto';

export class UpdateOrderAssignmentDto extends PartialType(
  CreateOrderAssignmentDto,
) {}
