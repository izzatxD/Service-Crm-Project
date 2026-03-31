import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @ApiProperty({ example: 'tashkent-service' })
  @IsString()
  @MinLength(2)
  organizationSlug: string;

  @ApiProperty()
  @IsString()
  @MinLength(32)
  token: string;

  @ApiProperty({ example: 'NewStrongPass123' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
