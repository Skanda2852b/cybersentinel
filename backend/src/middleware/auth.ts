import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type TokenPayload } from '@utils/jwt';
import { AuthenticationError, AuthorizationError } from '@middleware/errorHandler';
import { prisma } from '@utils/prisma';
import { logger } from '@utils/logger';

export interface AuthenticatedRequest extends Request {
  user: TokenPayload;
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const accessToken = req.cookies?.access_token;

    if (!accessToken) {
      throw new AuthenticationError('Access token required');
    }

    const payload = await verifyAccessToken(accessToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    (req as AuthenticatedRequest).user = { ...payload, sub: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    if (err instanceof AuthenticationError) throw err;
    logger.warn({ err }, 'Authentication failed');
    throw new AuthenticationError('Invalid or expired token');
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AuthorizationError(`Required role: ${roles.join(' or ')}`);
    }
    next();
  };
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const accessToken = req.cookies?.access_token;
    if (accessToken) {
      const payload = await verifyAccessToken(accessToken);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });
      if (user?.isActive) {
        (req as AuthenticatedRequest).user = { ...payload, sub: user.id, email: user.email, role: user.role };
      }
    }
    next();
  } catch {
    next();
  }
};