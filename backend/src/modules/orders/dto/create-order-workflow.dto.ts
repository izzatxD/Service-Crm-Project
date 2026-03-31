import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssetType,
  OrderPriority,
  OrderStatus,
  TaskStatus,
} from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? undefined : value;
}

class WorkflowClientDto {
  @ApiProperty({ example: 'Ali Valiyev' })
  @IsString()
  @Length(2, 255)
  fullName: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Doimiy mijoz' })
  @IsOptional()
  @IsString()
  note?: string;
}

class WorkflowAssetDto {
  @ApiProperty({ enum: AssetType, example: AssetType.vehicle })
  @IsEnum(AssetType)
  assetTypeCode: AssetType;

  @ApiProperty({ example: 'Chevrolet Cobalt' })
  @IsString()
  @Length(2, 255)
  displayName: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  statusCode?: string;

  @ApiPropertyOptional({ example: 'Oq rang, avtomat' })
  @IsOptional()
  @IsString()
  note?: string;
}

class WorkflowVehicleProfileDto {
  @ApiPropertyOptional({ example: 'Chevrolet' })
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional({ example: 'Cobalt' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2023 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: '01A123BC' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ example: 'XUF12345678900001' })
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiPropertyOptional({ example: '1.5 бензин' })
  @IsOptional()
  @IsString()
  engineType?: string;

  @ApiPropertyOptional({ example: 54000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;
}

class WorkflowOrderTaskDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  lineNo: number;

  @ApiPropertyOptional({ example: '11111111-1111-1111-1111-111111111111' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({ example: 'Moy almashtirish' })
  @IsString()
  @Length(2, 255)
  title: string;

  @ApiPropertyOptional({ example: '22222222-2222-2222-2222-222222222222' })
  @IsOptional()
  @IsUUID()
  assignedStaffId?: string;

  @ApiPropertyOptional({
    enum: TaskStatus,
    default: TaskStatus.pending,
    example: TaskStatus.pending,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ example: 120000 })
  @IsOptional()
  estimatedLaborAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  actualLaborAmount?: number;

  @ApiPropertyOptional({ example: 'Klient kutib turibdi' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderWorkflowDto {
  @ApiProperty({ example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ example: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' })
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ example: 'ORD-260326-001' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsString()
  @Length(2, 64)
  orderNumber?: string;

  @ApiProperty({ example: 'cccccccc-cccc-cccc-cccc-cccccccccccc' })
  @IsUUID()
  createdByStaffId: string;

  @ApiPropertyOptional({ example: 'dddddddd-dddd-dddd-dddd-dddddddddddd' })
  @IsOptional()
  @IsUUID()
  assignedManagerId?: string;

  @ApiPropertyOptional({
    enum: OrderStatus,
    default: OrderStatus.new,
    example: OrderStatus.new,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: OrderPriority,
    default: OrderPriority.normal,
    example: OrderPriority.normal,
  })
  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority;

  @ApiPropertyOptional({ example: 'Mashinadan g‘alati tovush chiqyapti' })
  @IsOptional()
  @IsString()
  customerRequestText?: string;

  @ApiPropertyOptional({ example: 'Avto servisga o‘zi haydab keldi' })
  @IsOptional()
  @IsString()
  intakeNotes?: string;

  @ApiPropertyOptional({
    example: 'Old g‘ildirak tomonda muammo bo‘lishi mumkin',
  })
  @IsOptional()
  @IsString()
  internalDiagnosisText?: string;

  @ApiProperty({
    type: WorkflowClientDto,
    example: {
      fullName: 'Ali Valiyev',
      phone: '+998901234567',
      note: 'Doimiy mijoz',
    },
  })
  @ValidateNested()
  @Type(() => WorkflowClientDto)
  client: WorkflowClientDto;

  @ApiProperty({
    type: WorkflowAssetDto,
    example: {
      assetTypeCode: 'vehicle',
      displayName: 'Chevrolet Cobalt',
      statusCode: 'active',
      note: 'Oq rang, avtomat',
    },
  })
  @ValidateNested()
  @Type(() => WorkflowAssetDto)
  asset: WorkflowAssetDto;

  @ApiPropertyOptional({
    type: WorkflowVehicleProfileDto,
    example: {
      make: 'Chevrolet',
      model: 'Cobalt',
      year: 2023,
      plateNumber: '01A123BC',
      vin: 'XUF12345678900001',
      engineType: '1.5 бензин',
      mileage: 54000,
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowVehicleProfileDto)
  vehicleProfile?: WorkflowVehicleProfileDto;

  @ApiPropertyOptional({
    type: [WorkflowOrderTaskDto],
    example: [
      {
        lineNo: 1,
        title: 'Moy almashtirish',
        status: 'pending',
        estimatedLaborAmount: 120000,
        actualLaborAmount: 0,
        note: 'Klient kutib turibdi',
      },
      {
        lineNo: 2,
        title: 'Kompyuter diagnostika',
        status: 'pending',
        estimatedLaborAmount: 80000,
        actualLaborAmount: 0,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowOrderTaskDto)
  tasks?: WorkflowOrderTaskDto[];
}
