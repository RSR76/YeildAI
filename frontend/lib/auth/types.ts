// Persona chosen at signup, fixed on the account. 'GUEST' is never a stored
// role — guest access has no account at all (see GuestContext) — but it's
// included here so UI code that branches on "what persona is this session"
// can treat guest as a first-class case alongside the two real roles.
export type Role = 'ADMIN' | 'FARMER';
export type Persona = Role | 'GUEST';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface FarmProfile {
  id: string;
  userId: string;
  name: string;
  location: string;
  address?: string;
  pincode: string;
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