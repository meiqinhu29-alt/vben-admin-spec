import type { UserRole } from '../enums/user-role.enum';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export interface UserInfoResult {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  shopIds: string[];
}
