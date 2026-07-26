import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { signAuthToken } from '../lib/jwt.js';

const SALT_ROUNDS = 10;

export class AuthConflictError extends Error {}
export class AuthInvalidCredentialsError extends Error {}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function toPublicUser(user: { id: string; email: string; name: string; createdAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export class AuthService {
  async signup({ email, password, name }: SignupInput) {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new AuthConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, name: name.trim() },
    });

    const token = signAuthToken({ userId: user.id, email: user.email });
    return { token, user: toPublicUser(user) };
  }

  async login({ email, password }: LoginInput) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new AuthInvalidCredentialsError('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AuthInvalidCredentialsError('Invalid email or password');
    }

    const token = signAuthToken({ userId: user.id, email: user.email });
    return { token, user: toPublicUser(user) };
  }

  async getById(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return toPublicUser(user);
  }
}