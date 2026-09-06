import { logging, Controllers, HttpMethod, UsersOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../types/dtos/common/PagedQuery";
import { UserDto, UserCreateDto, UserListDto } from "../types/dtos/auth/UserDtos";
import { ObjectManager } from "./objectManager";

export class UserClient extends ObjectManager {
    private static instance: UserClient;

    public static getInstance() {
        if (!UserClient.instance) {
            UserClient.instance = new UserClient();
            UserClient.instance.logger = logging.getLogger('UserClient');
        }
        return UserClient.instance;
    }

    getAll(): Promise<UserDto[]> {
        return this.invokeServiceCall(null, UsersOperation.GetAll, Controllers.Users, HttpMethod.Get);
    }

    getById(id: number): Promise<UserDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Users, HttpMethod.Get);
    }

    create(data: UserCreateDto): Promise<{ user: UserDto }> {
        return this.invokeServiceCall(data, UsersOperation.Create, Controllers.Users, HttpMethod.Post);
    }

    update(data: UserDto): Promise<void> {
        if (!data.id) {
            throw new Error('UserDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Users, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Users, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<UserListDto>> {
        return this.invokeServiceCall(queryParams, UsersOperation.SearchPaged, Controllers.Users, HttpMethod.Post);
    }
}

export const userClient = UserClient.getInstance();
