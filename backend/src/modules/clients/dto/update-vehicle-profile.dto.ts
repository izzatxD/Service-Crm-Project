import { PartialType } from '@nestjs/swagger';

import { CreateVehicleProfileDto } from './create-vehicle-profile.dto';

export class UpdateVehicleProfileDto extends PartialType(
  CreateVehicleProfileDto,
) {}
