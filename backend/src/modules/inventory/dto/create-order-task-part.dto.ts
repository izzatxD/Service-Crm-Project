import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateOrderTaskPartDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  orderTaskId: string;

  @ApiProperty()
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitCostAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPriceAmount: number;
}
