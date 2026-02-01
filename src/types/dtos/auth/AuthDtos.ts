import { UserDto } from "./UserDtos";

export interface LoginRequestDto {
  email: string;
  password: string;
  rememberMe: boolean;
}

  export interface AuthLoginRequestDto {
    email: string;
    password: string;
    rememberMe?: boolean;
  }

export interface AuthLoginResponseDto {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: UserDto;
}

export interface AuthRefreshRequestDto {
  refreshToken?: string;
}

export interface AuthRefreshResponseDto {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface AuthValidateTokenRequestDto {
  token: string;
}

export interface AuthValidateTokenResponseDto {
  valid: boolean;
  expiresAt?: Date;
}

export interface RegisterRequestDto {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
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

export interface LinkMinecraftAccountDto {
  linkCode: string;
}

export interface PasswordStrengthDto {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  feedback: string[];
}