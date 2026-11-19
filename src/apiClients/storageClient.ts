import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StorageDto, StorageListDto } from '../types/dtos/stock/StockDtos';

// Stock core P1 (PandiO/knk-workspace#97 API, #675 web app): storage CRUD + search (api/Storages). The totals, lines and
// units are written by the stock service only; stock moves through api/StockTransactions.
export class StorageClient extends ObjectManager {
    private static instance: StorageClient;

    public static getInstance() {
        if (!StorageClient.instance) {
            StorageClient.instance = new StorageClient();
            StorageClient.instance.logger = logging.getLogger('StorageClient');
        }
        return StorageClient.instance;
    }

    getAll(): Promise<StorageListDto[]> {
        return this.invokeServiceCall(null, '', Controllers.Storages, HttpMethod.Get);
    }

    /** With `lines`, `units` and `capacityUsed`. */
    getById(id: number): Promise<StorageDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Storages, HttpMethod.Get);
    }

    create(data: StorageDto): Promise<StorageDto> {
        return this.invokeServiceCall(data, '', Controllers.Storages, HttpMethod.Post);
    }

    /** A null kind or holder id keeps it; send `rowVersion` to get 409 on a stale edit. */
    update(data: StorageDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Storages, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Storages, HttpMethod.Delete);
    }

    /** Filters: `kind`, `purpose`, `domainId`, `userId`, `clanId`, `locked`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<StorageListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Storages, HttpMethod.Post);
    }
}

export const storageClient = StorageClient.getInstance();
