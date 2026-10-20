import 'dotenv/config';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { isUUID } from 'class-validator';

interface TokenIdentity {
  accountId: string;
  sessionId: string;
}

@Injectable()
export class PatientTokenService {
  private readonly secret: Uint8Array;
  private readonly issuer = 'larqon-hospitals-api';
  private readonly audience = 'larqon-hospitals-patient';

  constructor() {
    const secret = process.env.JWT_PATIENT_ACCESS_SECRET;

    if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
      throw new Error(
        'JWT_PATIENT_ACCESS_SECRET must contain exactly 64 hexadecimal characters.',
      );
    }

    this.secret = Buffer.from(secret, 'hex');
  }

  async create(identity: TokenIdentity): Promise<string> {
    return new SignJWT({
      sid: identity.sessionId,
      tokenUse: 'patient_access',
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setSubject(identity.accountId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.secret);
  }

  async verify(token: string): Promise<TokenIdentity> {
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
        !isUUID(payload.sub, '4') ||
        typeof payload.sid !== 'string' ||
        !isUUID(payload.sid, '4') ||
        payload.tokenUse !== 'patient_access'
      ) {
        throw new Error('Invalid patient token.');
      }

      return {
        accountId: payload.sub,
        sessionId: payload.sid,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired patient session.');
    }
  }
}
