import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffAccountAuthMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateStaffAccountDto {
  @ApiProperty({
    example: 'manager@acme.uz',
    description: 'Organization-scoped login identifier.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  loginIdentifier?: string;

  @ApiPropertyOptional({ example: 'StrongPass123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  telegramUserId?: string;

  @ApiPropertyOptional({ enum: StaffAccountAuthMode })
  @IsOptional()
  @IsEnum(StaffAccountAuthMode)
  authMode?: StaffAccountAuthMode;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
