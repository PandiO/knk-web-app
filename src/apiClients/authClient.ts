import { logging, Controllers, HttpMethod, DominionOperation } from "../utils";
import { ObjectManager } from "./objectManager";
import {
  LoginRequestDto,
  AuthLoginResponseDto,
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
    return this.invokeServiceCall(data, "login", Controllers.Auth, HttpMethod.Post);
  }

  register(data: RegisterRequestDto): Promise<UserDto> {
    return this.invokeServiceCall(data, "register", Controllers.Auth, HttpMethod.Post);
  }

  logout(): Promise<void> {
    return this.invokeServiceCall(null, "logout", Controllers.Auth, HttpMethod.Post);
  }

  refresh(): Promise<void> {
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
}

export const authClient = AuthClient.getInstance();