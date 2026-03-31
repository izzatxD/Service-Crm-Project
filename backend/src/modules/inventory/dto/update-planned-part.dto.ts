import { PartialType } from '@nestjs/swagger';

import { CreatePlannedPartDto } from './create-planned-part.dto';

export class UpdatePlannedPartDto extends PartialType(CreatePlannedPartDto) {}
