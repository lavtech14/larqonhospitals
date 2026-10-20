import type { CookieOptions, Response } from 'express';

function commonOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };
}

export function setPatientAuthCookies(
  response: Response,
  result: {
    accessToken: string;
    refreshToken: string;
    sessionExpiresAt: Date;
  },
) {
  const accessExpiresAt = new Date(
    Math.min(Date.now() + 15 * 60_000, result.sessionExpiresAt.getTime()),
  );

  response.cookie('larqon_patient_access', result.accessToken, {
    ...commonOptions(),
    path: '/api/patient',
    expires: accessExpiresAt,
  });

  response.cookie('larqon_patient_refresh', result.refreshToken, {
    ...commonOptions(),
    path: '/api/patient/auth',
    expires: result.sessionExpiresAt,
  });
}

export function clearPatientAuthCookies(response: Response) {
  response.clearCookie('larqon_patient_access', {
    ...commonOptions(),
    path: '/api/patient',
  });

  response.clearCookie('larqon_patient_refresh', {
    ...commonOptions(),
    path: '/api/patient/auth',
  });
}
