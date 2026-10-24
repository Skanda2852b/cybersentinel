import { authenticator } from 'otplib';

export interface TOTPSecret {
  secret: string;
  otpauthUrl: string;
}

export function generateTOTPSecret(email: string): TOTPSecret {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, 'CyberSentinel', secret);
  return { secret, otpauthUrl };
}

export function verifyTOTPToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}

export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase());
  }
  return codes;
}
