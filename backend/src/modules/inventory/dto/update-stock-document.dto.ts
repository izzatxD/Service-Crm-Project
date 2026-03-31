import { PartialType } from '@nestjs/swagger';

import { CreateStockDocumentDto } from './create-stock-document.dto';

export class UpdateStockDocumentDto extends PartialType(
  CreateStockDocumentDto,
) {}
