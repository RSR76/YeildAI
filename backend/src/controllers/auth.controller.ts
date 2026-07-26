import type { Response } from 'express';
import { z } from 'zod';
import { AuthService, AuthConflictError, AuthInvalidCredentialsError } from '../services/auth.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const authService = new AuthService();

const signupSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  async signup(req: AuthenticatedRequest, res: Response) {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    try {
      const result = await authService.signup(parsed.data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AuthConflictError) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async login(req: AuthenticatedRequest, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    try {
      const result = await authService.login(parsed.data);
      res.json(result);
    } catch (error) {
      if (error instanceof AuthInvalidCredentialsError) {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async me(req: AuthenticatedRequest, res: Response) {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await authService.getById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}