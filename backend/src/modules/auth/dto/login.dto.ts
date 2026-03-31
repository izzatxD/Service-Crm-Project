import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({
    example: 'tashkent-service',
    description:
      'Optional legacy tenant hint. Regular login now works with loginIdentifier + password only.',
  })
  @IsOptional()
  @IsString()
  organizationSlug?: string;

  @ApiPropertyOptional({
    example: 'demo+admin@crm.local',
    description: 'Login or email for both platform admin and staff accounts.',
  })
  @IsOptional()
  @IsString()
  loginIdentifier?: string;

  @ApiPropertyOptional({
    example: 'admin@example.com',
    deprecated: true,
    description: 'Legacy alias for loginIdentifier.',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @MinLength(6)
  password: string;
}
