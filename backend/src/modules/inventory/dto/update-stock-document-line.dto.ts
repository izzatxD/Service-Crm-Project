import { PartialType } from '@nestjs/swagger';

import { CreateStockDocumentLineDto } from './create-stock-document-line.dto';

export class UpdateStockDocumentLineDto extends PartialType(
  CreateStockDocumentLineDto,
) {}
