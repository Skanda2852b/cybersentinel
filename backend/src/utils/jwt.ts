import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config';

const JWT_SECRET = new TextEncoder().encode(config.JWT_SECRET);
const JWT_REFRESH_SECRET = new TextEncoder().encode(config.JWT_REFRESH_SECRET);

export interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export async function signAccessToken(payload: Omit<TokenPayload, 'type' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: Omit<TokenPayload, 'type' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.JWT_REFRESH_EXPIRES_IN)
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload as TokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return payload as TokenPayload;
}

export function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    maxAge,
    path: '/',
  };
}

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;