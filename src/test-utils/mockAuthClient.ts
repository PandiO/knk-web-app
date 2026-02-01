/**
 * Mock AuthClient for testing
 * Provides predictable responses for registration flow tests
 */

import { RegisterRequestDto, LinkCodeResponseDto } from '../types/dtos/auth/AuthDtos';
import { UserDto, AccountCreationMethod } from '../types/dtos/auth/UserDtos';

export const mockUserResponse: UserDto = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  emailVerified: false,
  isActive: true,
  coins: 0,
  gems: 0,
  experiencePoints: 0,
  uuid: null,
  accountCreatedVia: AccountCreationMethod.WebApp,
  createdAt: new Date(),
};

export const mockLinkCodeResponse: LinkCodeResponseDto = {
  code: 'ABC12XYZ',
  expiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes from now
};

export class MockAuthClient {
  private registerShouldFail = false;
  private registerErrorCode: string | null = null;
  private linkCodeShouldFail = false;

  // Configure mock behaviors
  setRegisterFailure(errorCode: string) {
    this.registerShouldFail = true;
    this.registerErrorCode = errorCode;
  }

  setLinkCodeFailure() {
    this.linkCodeShouldFail = true;
  }

  reset() {
    this.registerShouldFail = false;
    this.registerErrorCode = null;
    this.linkCodeShouldFail = false;
  }

  // Mock methods
  async register(data: RegisterRequestDto): Promise<UserDto> {
    if (this.registerShouldFail) {
      throw {
        code: this.registerErrorCode,
        message: this.getErrorMessage(this.registerErrorCode),
        response: {
          code: this.registerErrorCode,
          message: this.getErrorMessage(this.registerErrorCode),
        },
      };
    }

    return {
      ...mockUserResponse,
      email: data.email,
      username: data.username || data.email,
    };
  }

  async requestLinkCode(_data: { email: string }): Promise<LinkCodeResponseDto> {
    if (this.linkCodeShouldFail) {
      throw new Error('Failed to generate link code');
    }

    return mockLinkCodeResponse;
  }

  async checkEmailAvailable(email: string): Promise<{ available: boolean }> {
    // Mock implementation - email is available unless it's "taken@example.com"
    return { available: email !== 'taken@example.com' };
  }

  async checkUsernameAvailable(username: string): Promise<{ available: boolean }> {
    // Mock implementation - username is available unless it's "takenuser"
    return { available: username !== 'takenuser' };
  }

  async login(data: { email: string; password: string; rememberMe?: boolean }): Promise<any> {
    return {
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      expiresIn: 3600,
      user: {
        ...mockUserResponse,
        email: data.email,
      },
    };
  }

  async logout(): Promise<void> {
    return Promise.resolve();
  }

  async me(): Promise<UserDto> {
    return mockUserResponse;
  }

  async refresh(): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    return {
      accessToken: 'mock-token-refreshed',
      refreshToken: 'mock-refresh-refreshed',
      expiresIn: 3600,
    };
  }

  async updateUser(data: any): Promise<UserDto> {
    return {
      ...mockUserResponse,
      ...data,
    };
  }

  private getErrorMessage(code: string | null): string {
    switch (code) {
      case 'DuplicateEmail':
        return 'Email is already in use';
      case 'DuplicateUsername':
        return 'Username is already taken';
      case 'InvalidPassword':
        return 'Password must be at least 8 characters long';
      case 'WeakPassword':
        return 'Password is too common or weak';
      case 'ServerError':
        return 'Something went wrong. Please try again';
      default:
        return 'Registration failed';
    }
  }
}

export const mockAuthClient = new MockAuthClient();
