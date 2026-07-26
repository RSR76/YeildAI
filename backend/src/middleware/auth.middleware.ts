import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../lib/jwt.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Requires a valid `Authorization: Bearer <token>` header. On success,
 * attaches `userId` / `userEmail` to the request for downstream handlers.
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
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}