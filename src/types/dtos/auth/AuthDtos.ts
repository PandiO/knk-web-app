import { UserDto } from "./UserDtos";

export interface LoginRequestDto {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthLoginResponseDto {
  user: UserDto;
}

export interface RegisterRequestDto {
  username: string;
  email: string;
  password: string;
  minecraftUsername?: string;
  linkCode?: string;
}

export interface PasswordChangeDto {
  currentPassword: string;
  newPassword: string;
}

export interface LinkCodeRequestDto {
  userId: number;
}

export interface LinkCodeResponseDto {
  code: string;
  expiresAt: Date;
}

export interface AccountMergeDto {
  primaryUserId: number;
  secondaryUserId: number;
}

export interface PasswordStrengthDto {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  feedback: string[];
}