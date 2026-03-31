import { PartialType } from '@nestjs/swagger';

import { CreateInventoryStockDto } from './create-inventory-stock.dto';

export class UpdateInventoryStockDto extends PartialType(
  CreateInventoryStockDto,
) {}
