import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { UserSiegeWeaponUnlockDto } from '../types/dtos/siege/SiegeWeaponDtos';

// Siege weapons phase 1 (PandiO/knk-workspace#782): a player's weapon type unlocks; staff grant and revoke them.
export class UserSiegeWeaponUnlockClient extends ObjectManager {
    private static instance: UserSiegeWeaponUnlockClient;

    public static getInstance() {
        if (!UserSiegeWeaponUnlockClient.instance) {
            UserSiegeWeaponUnlockClient.instance = new UserSiegeWeaponUnlockClient();
            UserSiegeWeaponUnlockClient.instance.logger = logging.getLogger('UserSiegeWeaponUnlockClient');
        }
        return UserSiegeWeaponUnlockClient.instance;
    }

    getAll(): Promise<UserSiegeWeaponUnlockDto[]> {
        return this.invokeServiceCall(null, '', Controllers.UserSiegeWeaponUnlocks, HttpMethod.Get);
    }

    getById(id: number): Promise<UserSiegeWeaponUnlockDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.UserSiegeWeaponUnlocks, HttpMethod.Get);
    }

    create(data: UserSiegeWeaponUnlockDto): Promise<UserSiegeWeaponUnlockDto> {
        return this.invokeServiceCall(data, '', Controllers.UserSiegeWeaponUnlocks, HttpMethod.Post);
    }

    update(data: UserSiegeWeaponUnlockDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.UserSiegeWeaponUnlocks, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.UserSiegeWeaponUnlocks, HttpMethod.Delete);
    }

    getByUser(userId: number): Promise<UserSiegeWeaponUnlockDto[]> {
        return this.invokeServiceCall(null, `by-user/${userId}`, Controllers.UserSiegeWeaponUnlocks, HttpMethod.Get);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<UserSiegeWeaponUnlockDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.UserSiegeWeaponUnlocks, HttpMethod.Post);
    }
}

export const userSiegeWeaponUnlockClient = UserSiegeWeaponUnlockClient.getInstance();
