import { PartialType } from '@nestjs/swagger';

import { CreateOrderApprovalDto } from './create-order-approval.dto';

export class UpdateOrderApprovalDto extends PartialType(
  CreateOrderApprovalDto,
) {}
