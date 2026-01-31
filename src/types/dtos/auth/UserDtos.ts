export enum AccountCreationMethod {
  WebApp = 0,
  MinecraftServer = 1,
}

export interface UserDto {
  id: number;
  uuid?: string | null;
  username: string;
  email?: string | null;
  emailVerified: boolean;
  accountCreatedVia: AccountCreationMethod;
  lastPasswordChangeAt?: Date | null;
  lastEmailChangeAt?: Date | null;
  isActive: boolean;
  deletedAt?: Date | null;
  deletedReason?: string | null;
  archiveUntil?: Date | null;
  coins: number;
  gems: number;
  experiencePoints: number;
  createdAt: Date;
}

// New/Updated UserCreateDto (frontend-side typing per backend spec)
export interface UserCreateDto {
  username: string;
  email?: string;
  password?: string;
  minecraftUsername?: string;
  createdAt: Date; // defaulted to UTC now in UI
}

// Settings update (email/password); requires currentPassword to change password
export interface UserUpdateDto {
  email?: string;
  newPassword?: string;
  currentPassword?: string; // required if newPassword is provided
}