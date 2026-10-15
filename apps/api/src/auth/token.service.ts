import 'dotenv/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export type AccessIdentity = {
  userId: string;
  sessionId: string;
};

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;
  private readonly issuer = 'larqon-hospitals-api';
  private readonly audience = 'larqon-hospitals-staff';

  constructor() {
    const secretHex = process.env.JWT_ACCESS_SECRET;

    if (!secretHex || !/^[a-fA-F0-9]{64}$/.test(secretHex)) {
      throw new Error(
        'JWT_ACCESS_SECRET must contain exactly 64 hexadecimal characters.',
      );
    }

    this.secret = Buffer.from(secretHex, 'hex');
  }

  async createAccessToken(identity: AccessIdentity): Promise<string> {
    return new SignJWT({
      sid: identity.sessionId,
      tokenUse: 'access',
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setSubject(identity.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<AccessIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
        typ: 'JWT',
        requiredClaims: ['sub', 'sid', 'iat', 'exp', 'jti'],
        maxTokenAge: '15m',
      });

      if (
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        typeof payload.sid !== 'string' ||
        payload.sid.length === 0 ||
        payload.tokenUse !== 'access'
      ) {
        throw new Error('Invalid access-token claims.');
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
