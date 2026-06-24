import { ApiProperty } from '@nestjs/swagger';

/**
 * Token pair returned by register / login / refresh. The access token is
 * short-lived and sent on every request; the refresh token is long-lived and
 * exchanged for a new access token when the old one expires.
 */
export class AuthTokensDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string = 'Bearer';
}
