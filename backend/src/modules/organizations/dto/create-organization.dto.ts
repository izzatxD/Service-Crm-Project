import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  @Length(2, 255)
  name: string;

  @ApiPropertyOptional({
    example: 'tashkent-service',
    description:
      'Stable tenant login slug used by organization-scoped authentication.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  slug?: string;

  @ApiPropertyOptional({ default: 'auto_service' })
  @IsOptional()
  @IsString()
  businessTypeCode?: string;

  @ApiPropertyOptional({ default: 'Asia/Tashkent' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: 'UZS' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
