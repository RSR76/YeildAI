export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface FarmProfile {
  id: string;
  userId: string;
  name: string;
  location: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  state: string;
  district: string;
  sizeAcres: number;
  soilType: string;
  crops: string[];
  irrigation: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateFarmInput = Omit<
  FarmProfile,
  'id' | 'userId' | 'isDefault' | 'createdAt' | 'updatedAt'
>;

export interface AuthResponse {
  token: string;
  user: AuthUser;
}