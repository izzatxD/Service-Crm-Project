import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LinkStaffAccountTelegramDto {
  @ApiProperty({ example: '123456789' })
  @IsString()
  @MinLength(3)
  telegramUserId: string;
}
