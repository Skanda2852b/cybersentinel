import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@utils/prisma';
import { authenticate } from '@middleware/auth';
import { signAccessToken, signRefreshToken, verifyRefreshToken, getCookieOptions, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from '@utils/jwt';
import { ConflictError, ValidationError, AuthenticationError } from '@middleware/errorHandler';
import { strictRateLimiter } from '@middleware/rateLimiter';
import { config } from '@config';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
});

router.post('/register', strictRateLimiter, async (req, res: Response) => {
  const { email, password, firstName, lastName } = registerSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

  // Least privilege: self-registration always creates VIEWER accounts.
  // Admins can promote users afterwards. Never accept a client-supplied role.
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: 'VIEWER',
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
    },
  });

  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = await signAccessToken(payload);
  const refreshToken = await signRefreshToken(payload);

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE));

  res.status(201).json({
    user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
  });
});

router.post('/login', strictRateLimiter, async (req, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    throw new AuthenticationError('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Invalid credentials');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = await signAccessToken(payload);
  const refreshToken = await signRefreshToken(payload);

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE));

  res.json({
    user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
  });
});

router.post('/logout', (_req, res: Response) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  res.json({ success: true });
});

router.get('/me', authenticate, async (req, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
  if (!user) throw new AuthenticationError('User not found');
  res.json(user);
});

const updateProfileSchema = z.object({
  firstName: z.string().trim().max(100).nullish(),
  lastName: z.string().trim().max(100).nullish(),
});

router.patch('/me', authenticate, async (req, res: Response) => {
  const { firstName, lastName } = updateProfileSchema.parse(req.body);

  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: {
      ...(firstName !== undefined ? { firstName: firstName?.trim() || null } : {}),
      ...(lastName !== undefined ? { lastName: lastName?.trim() || null } : {}),
    },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true },
  });

  res.json(user);
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

router.post('/change-password', authenticate, strictRateLimiter, async (req, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user || !user.isActive) {
    throw new AuthenticationError('User not found or inactive');
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ success: true });
});

router.post('/refresh', async (req, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!refreshToken) {
    throw new AuthenticationError('Refresh token required');
  }

  try {
    const payload = await verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    const newPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await signAccessToken(newPayload);
    const newRefreshToken = await signRefreshToken(newPayload);

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
    res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE));

    res.json({ success: true });
  } catch {
    throw new AuthenticationError('Invalid refresh token');
  }
});

export default router;