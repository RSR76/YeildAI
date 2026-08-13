import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: Role;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to your .env file.');
  }

  return secret;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as NonNullable<
    jwt.SignOptions['expiresIn']
  >;

  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getSecret());

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Record<string, unknown>).userId !== 'string' ||
    typeof (decoded as Record<string, unknown>).email !== 'string' ||
    typeof (decoded as Record<string, unknown>).role !== 'string'
  ) {
    throw new Error('Malformed auth token payload');
  }

  const { userId, email, role } = decoded as {
    userId: string;
    email: string;
    role: Role;
  };

  if (role !== 'ADMIN' && role !== 'FARMER') {
    throw new Error('Invalid role in auth token');
  }

  return {
    userId,
    email,
    role,
  };
}