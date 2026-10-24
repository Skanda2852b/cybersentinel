import { TOTP, generateSecret, generateURI, verify } from 'otplib';

export interface TOTPSecret {
  secret: string;
  otpauthUrl: string;
}

export function generateTOTPSecret(email: string): TOTPSecret {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ secret, issuer: 'CyberSentinel', label: email });
  return { secret, otpauthUrl };
}

export async function verifyTOTPToken(token: string, secret: string): Promise<boolean> {
  const result = await verify({ token, secret });
  return result.valid;
}

export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase());
  }
  return codes;
}
