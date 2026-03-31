import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'tashkent-service' })
  @IsString()
  @MinLength(2)
  organizationSlug: string;

  @ApiPropertyOptional({
    example: 'manager@acme.uz',
    description: 'Organization-scoped login identifier.',
  })
  @IsOptional()
  @IsString()
  loginIdentifier?: string;

  @ApiPropertyOptional({
    example: 'manager@acme.uz',
    deprecated: true,
    description: 'Legacy alias for loginIdentifier.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
