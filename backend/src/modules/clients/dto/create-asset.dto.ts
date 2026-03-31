import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  assetTypeCode: AssetType;

  @ApiProperty()
  @IsString()
  @Length(2, 255)
  displayName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
