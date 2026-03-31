import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ enum: ['staff', 'platform_admin'] })
  authType: 'staff' | 'platform_admin';

  @ApiProperty({ required: false, nullable: true })
  userId: string | null;

  @ApiProperty({ required: false, nullable: true })
  accountId: string | null;

  @ApiProperty({ required: false, nullable: true })
  staffMemberId: string | null;

  @ApiProperty({ required: false, nullable: true })
  organizationId: string | null;

  @ApiProperty({ required: false, nullable: true })
  organizationSlug: string | null;

  @ApiProperty({ required: false, nullable: true })
  email: string | null;

  @ApiProperty({ required: false, nullable: true })
  loginIdentifier: string | null;

  @ApiProperty()
  isPlatformAdmin: boolean;

  @ApiProperty()
  sessionVersion: number;

  @ApiProperty()
  mustChangePassword: boolean;

  @ApiProperty({ type: [String] })
  organizationIds: string[];

  @ApiProperty({ type: [String] })
  permissionCodes: string[];
}
