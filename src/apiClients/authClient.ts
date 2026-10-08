import { logging, Controllers, HttpMethod } from "../utils";
import { ObjectManager } from "./objectManager";
import {
  LoginRequestDto,
  AuthLoginResponseDto,
  RegisterRequestDto,
  AuthUpdateResponseDto,
  ForgotPasswordRequestDto,
  ForgotPasswordResponseDto,
  ResetPasswordRequestDto,
  ResetPasswordResponseDto,
  AccountMergeDto,
  LinkMinecraftAccountDto,
  ValidateLinkCodeResponseDto,
} from "../types/dtos/auth/AuthDtos";
import { UserDto, UserUpdateDto } from "../types/dtos/auth/UserDtos";

export class AuthClient extends ObjectManager {
  private static instance: AuthClient;

  public static getInstance() {
    if (!AuthClient.instance) {
      AuthClient.instance = new AuthClient();
      AuthClient.instance.logger = logging.getLogger("AuthClient");
    }
    return AuthClient.instance;
  }

  // Every call goes out with credentials: 'include' (serviceCall), so the HttpOnly refresh cookie
  // the API sets on /api/Auth travels with login, register, refresh and logout.

  /** `login` is an email address or a Minecraft username. */
  login(data: LoginRequestDto): Promise<AuthLoginResponseDto> {
    const loginRequest = {
      login: data.login,
      password: data.password,
      rememberMe: data.rememberMe ?? false,
    };
    return this.invokeServiceCall(loginRequest, "login", Controllers.Auth, HttpMethod.Post);
  }

  /** Registration with a link code from `/account link`; answers like login (the player is logged in). */
  register(data: RegisterRequestDto): Promise<AuthLoginResponseDto> {
    return this.invokeServiceCall(data, "register", Controllers.Auth, HttpMethod.Post);
  }

  logout(): Promise<void> {
    return this.invokeServiceCall({}, "logout", Controllers.Auth, HttpMethod.Post);
  }

  /** Ends every session of the logged-in user, on every device. */
  logoutAll(): Promise<void> {
    return this.invokeServiceCall({}, "logout-all", Controllers.Auth, HttpMethod.Post);
  }

  me(): Promise<UserDto> {
    return this.invokeServiceCall(null, "me", Controllers.Auth, HttpMethod.Get);
  }

  forgotPassword(data: ForgotPasswordRequestDto): Promise<ForgotPasswordResponseDto> {
    return this.invokeServiceCall(data, "forgot-password", Controllers.Auth, HttpMethod.Post);
  }

  resetPassword(data: ResetPasswordRequestDto): Promise<ResetPasswordResponseDto> {
    return this.invokeServiceCall(data, "reset-password", Controllers.Auth, HttpMethod.Post);
  }

  mergeAccounts(data: AccountMergeDto): Promise<UserDto> {
    return this.invokeServiceCall(data, "merge", Controllers.Auth, HttpMethod.Post);
  }

  /** Changing the email needs `currentPassword`; the response may carry a fresh access token. */
  updateUser(data: UserUpdateDto): Promise<AuthUpdateResponseDto> {
    return this.invokeServiceCall(data, "update", Controllers.Auth, HttpMethod.Put);
  }

  // Link codes go one way only: the game server generates them (/account link), the web app
  // consumes them (register, or linking a legacy web-only account).

  /** Which Minecraft account a code belongs to. Read-only: the code stays usable. */
  validateLinkCode(code: string): Promise<ValidateLinkCodeResponseDto> {
    return this.invokeServiceCall(null, `validate-link-code/${encodeURIComponent(code)}`, Controllers.Users, HttpMethod.Post);
  }

  /**
   * Link a legacy web-only account (email and password, no Minecraft account) to the Minecraft
   * account a link code belongs to. Requires authentication.
   */
  linkMinecraftAccount(data: LinkMinecraftAccountDto): Promise<UserDto> {
    return this.invokeServiceCall(data, "link-minecraft-account", Controllers.Users, HttpMethod.Post);
  }
}

export const authClient = AuthClient.getInstance();