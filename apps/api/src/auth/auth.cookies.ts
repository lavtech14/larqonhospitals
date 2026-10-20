import type { CookieOptions, Response } from 'express';

function cookieOptions(path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path,
  };
}

export function setAuthCookies(
  response: Response,
  tokens: {
    accessToken: string;
    refreshToken: string;
    sessionExpiresAt: Date;
  },
) {
  const remainingSessionMs = Math.max(
    0,
    tokens.sessionExpiresAt.getTime() - Date.now(),
  );

  response.cookie('larqon_access', tokens.accessToken, {
    ...cookieOptions('/api'),
    maxAge: Math.min(15 * 60 * 1000, remainingSessionMs),
  });

  response.cookie('larqon_refresh', tokens.refreshToken, {
    ...cookieOptions('/api/auth'),
    expires: tokens.sessionExpiresAt,
  });
}

export function clearAuthCookies(response: Response) {
  response.clearCookie('larqon_access', cookieOptions('/api'));

  response.clearCookie('larqon_refresh', cookieOptions('/api/auth'));
}
