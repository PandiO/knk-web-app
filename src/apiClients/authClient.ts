import { logging, Controllers, HttpMethod } from "../utils";
import { ObjectManager } from "./objectManager";
import {
  LoginRequestDto,
  AuthLoginResponseDto,
  AuthRefreshResponseDto,
  RegisterRequestDto,
  PasswordChangeDto,
  LinkCodeRequestDto,
  LinkCodeResponseDto,
  AccountMergeDto,
} from "../types/dtos/auth/AuthDtos";
import { UserDto, UserCreateDto, UserUpdateDto } from "../types/dtos/auth/UserDtos";

export class AuthClient extends ObjectManager {
  private static instance: AuthClient;

  public static getInstance() {
    if (!AuthClient.instance) {
      AuthClient.instance = new AuthClient();
      AuthClient.instance.logger = logging.getLogger("AuthClient");
    }
    return AuthClient.instance;
  }

  // Auth endpoints (per roadmap Part G)
  login(data: LoginRequestDto): Promise<AuthLoginResponseDto> {
    const loginRequest = {
      email: data.email,
      password: data.password,
      rememberMe: data.rememberMe ?? false,
    };
    return this.invokeServiceCall(loginRequest, "login", Controllers.Auth, HttpMethod.Post);
  }

  register(data: RegisterRequestDto): Promise<UserDto> {
    return this.invokeServiceCall(data, "", Controllers.Users, HttpMethod.Post);
  }

  logout(): Promise<void> {
    return this.invokeServiceCall(null, "logout", Controllers.Auth, HttpMethod.Post);
  }

  refresh(): Promise<AuthRefreshResponseDto> {
    return this.invokeServiceCall(null, "refresh", Controllers.Auth, HttpMethod.Post);
  }

  me(): Promise<UserDto> {
    return this.invokeServiceCall(null, "me", Controllers.Auth, HttpMethod.Get);
  }

  requestLinkCode(data: LinkCodeRequestDto): Promise<LinkCodeResponseDto> {
    return this.invokeServiceCall(data, "link-code", Controllers.Auth, HttpMethod.Post);
  }

  mergeAccounts(data: AccountMergeDto): Promise<UserDto> {
    return this.invokeServiceCall(data, "merge", Controllers.Auth, HttpMethod.Post);
  }

  updateUser(data: UserUpdateDto): Promise<UserDto> {
    return this.invokeServiceCall(data, "update", Controllers.Auth, HttpMethod.Put);
  }

  // Link code operations
  generateLinkCode(): Promise<LinkCodeResponseDto> {
    return this.invokeServiceCall(null, "generate-link-code", Controllers.Users, HttpMethod.Post);
  }

  linkAccount(data: { linkCode: string; email: string; password: string }): Promise<UserDto> {
    return this.invokeServiceCall(data, "link-account", Controllers.Users, HttpMethod.Post);
  }

  // Availability checks (email/username)
  checkEmailAvailable(email: string): Promise<{ available: boolean }> {
    return this.invokeServiceCall({ email }, "check-duplicate", Controllers.Users, HttpMethod.Get);
  }

  checkUsernameAvailable(username: string): Promise<{ available: boolean }> {
    return this.invokeServiceCall({ username }, "check-duplicate", Controllers.Users, HttpMethod.Get);
  }
}

export const authClient = AuthClient.getInstance();