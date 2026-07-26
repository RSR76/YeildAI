import jwt from 'jsonwebtoken';

export interface AuthTokenPayload {
    userId: string;
    email: string;
}
        
function getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not set. Add it to your .env file.');
    }
    return secret;
}

export function signAuthToken(payload: AuthTokenPayload): string {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as NonNullable<jwt.SignOptions['expiresIn']>;
    return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
    return jwt.verify(token, getSecret()) as AuthTokenPayload;
}