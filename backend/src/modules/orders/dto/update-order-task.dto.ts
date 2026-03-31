import { PartialType } from '@nestjs/swagger';

import { CreateOrderTaskDto } from './create-order-task.dto';

export class UpdateOrderTaskDto extends PartialType(CreateOrderTaskDto) {}
