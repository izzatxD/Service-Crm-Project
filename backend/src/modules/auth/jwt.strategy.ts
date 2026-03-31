import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService } from './auth.service';
import type {
  AuthenticatedUser,
  JwtTokenPayload,
} from './interfaces/auth-user.interface';

type JwtExtractor = (request: {
  headers?: { authorization?: string };
}) => string | null;
type JwtStrategyOptions = {
  jwtFromRequest: JwtExtractor;
  ignoreExpiration: boolean;
  secretOrKey: string;
};

const JwtPassportBase = PassportStrategy(
  Strategy as new (options: JwtStrategyOptions) => object,
);
const jwtExtractorFactory = ExtractJwt as unknown as {
  fromAuthHeaderAsBearerToken: () => JwtExtractor;
};

@Injectable()
export class JwtStrategy extends JwtPassportBase {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const strategyOptions: JwtStrategyOptions = {
      jwtFromRequest: jwtExtractorFactory.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('app.jwtSecret'),
    };

    super(strategyOptions);
  }

  validate(payload: JwtTokenPayload): Promise<AuthenticatedUser> {
    return this.authService.validateJwtPayload(payload);
  }
}
