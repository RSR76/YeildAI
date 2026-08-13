import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../lib/jwt.js';
import type { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: Role;
}

/**
 * Requires a valid `Authorization: Bearer <token>` header. On success,
 * attaches `userId` / `userEmail` / `userRole` to the request for
 * downstream handlers.
 *
 * NOTE: this assumes `signAuthToken` / `verifyAuthToken` in `lib/jwt.ts`
 * carry a `role` field in the payload (see the updated call site in
 * `services/auth.service.ts`). `lib/jwt.ts` wasn't included in the files
 * you shared, so add `role: Role` to its payload type/signature if it
 * isn't there already.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = verifyAuthToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Gate a route to one or more roles. Must run after `requireAuth`.
 * Usage: router.get('/admin/regions', requireAuth, requireRole('ADMIN'), ...)
 */
export function requireRole(...allowed: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !allowed.includes(req.userRole)) {
      return res.status(403).json({ error: 'You do not have access to this resource' });
    }
    next();
  };
}