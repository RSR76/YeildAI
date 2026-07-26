import { apiRequest } from '@/lib/api';
import type { AuthResponse, AuthUser, FarmProfile, CreateFarmInput } from './types.ts';

export function signup(input: { email: string; password: string; name: string }): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/signup', { method: 'POST', body: input, auth: false });
}

export function login(input: { email: string; password: string }): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false });
}

export function getMe(): Promise<AuthUser> {
    return apiRequest<AuthUser>('/auth/me', { method: 'GET' });
}

export function listFarms(): Promise<FarmProfile[]> {
    return apiRequest<FarmProfile[]>('/farms', { method: 'GET' });
}

export function createFarm(input: CreateFarmInput): Promise<FarmProfile> {
    return apiRequest<FarmProfile>('/farms', { method: 'POST', body: input });
}

export function updateFarm(id: string, input: Partial<CreateFarmInput>): Promise<FarmProfile> {
    return apiRequest<FarmProfile>(`/farms/${id}`, { method: 'PATCH', body: input });
}

export function deleteFarm(id: string): Promise<void> {
    return apiRequest<void>(`/farms/${id}`, { method: 'DELETE' });
}

export function activateFarm(id: string): Promise<FarmProfile> {
    return apiRequest<FarmProfile>(`/farms/${id}/activate`, { method: 'POST' });
}