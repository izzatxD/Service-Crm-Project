import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetStaffAccountPasswordDto {
  @ApiProperty({ example: 'ResetPass123' })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
