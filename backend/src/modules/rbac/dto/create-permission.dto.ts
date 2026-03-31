import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty()
  @IsString()
  @Length(2, 128)
  code: string;

  @ApiProperty()
  @IsString()
  @Length(2, 255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
