import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TelegramLoginDto {
  @ApiProperty({ example: 'tashkent-service' })
  @IsString()
  @MinLength(2)
  organizationSlug: string;

  @ApiProperty({ example: '123456789' })
  @IsString()
  @MinLength(3)
  telegramUserId: string;
}
