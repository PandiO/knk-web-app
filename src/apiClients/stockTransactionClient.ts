import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import {
    StockAdjustRequestDto,
    StockMoveDto,
    StockMoveRequestDto,
    StockMoveRollupDto,
    StockPagedQueryDto,
    StockPagedResultDto,
    StockReconciliationReportDto,
    StockResultDto,
    StockReverseRequestDto,
    StockRollupResultDto,
    StockTransactionDto,
    StockTransactionListDto,
} from '../types/dtos/stock/StockDtos';

// Stock core P1 (PandiO/knk-workspace#97 API, #675 web app): the ledger (api/StockTransactions). Reads: the World area
// or knk.economy.admin; writes (move, adjust, reverse, roll-up): knk.economy.admin. Capacity, missing stock and locks
// come back as 200 with a `status` and a per-line `rejectReason`, never as errors.
export class StockTransactionClient extends ObjectManager {
    private static instance: StockTransactionClient;

    public static getInstance() {
        if (!StockTransactionClient.instance) {
            StockTransactionClient.instance = new StockTransactionClient();
            StockTransactionClient.instance.logger = logging.getLogger('StockTransactionClient');
        }
        return StockTransactionClient.instance;
    }

    /** With its moves and `reversedByTransactionId`. */
    getById(id: number): Promise<StockTransactionDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.StockTransactions, HttpMethod.Get);
    }

    /** The dashboard's search (the app's paged query, mapped by entityApiMapping). */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<StockTransactionListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.StockTransactions, HttpMethod.Post);
    }

    /** The ledger explorer: transactions with filters (`storageId`, `itemBlueprintId`, `reason`, `actorUserId`, ...). */
    searchTransactions(query: StockPagedQueryDto): Promise<StockPagedResultDto<StockTransactionListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.StockTransactions, HttpMethod.Post);
    }

    /** Moves with filters; `storageId` + `itemBlueprintId` is the drill-down from a stock line's number. */
    searchMoves(query: StockPagedQueryDto): Promise<StockPagedResultDto<StockMoveDto>> {
        return this.invokeServiceCall(query, 'moves/search', Controllers.StockTransactions, HttpMethod.Post);
    }

    /** The 30-day roll-up rows (G3) with the same filters. */
    searchRollups(query: StockPagedQueryDto): Promise<StockPagedResultDto<StockMoveRollupDto>> {
        return this.invokeServiceCall(query, 'rollups/search', Controllers.StockTransactions, HttpMethod.Post);
    }

    /** Runs the reconciler now (read-only). */
    reconcile(): Promise<StockReconciliationReportDto> {
        return this.invokeServiceCall(null, 'reconcile', Controllers.StockTransactions, HttpMethod.Get);
    }

    move(data: StockMoveRequestDto): Promise<StockResultDto> {
        return this.invokeServiceCall(data, '', Controllers.StockTransactions, HttpMethod.Post);
    }

    adjust(data: StockAdjustRequestDto): Promise<StockResultDto> {
        return this.invokeServiceCall(data, 'adjust', Controllers.StockTransactions, HttpMethod.Post);
    }

    /** A compensating correction that moves every move of the transaction back (never an edit). */
    reverse(id: number, data: StockReverseRequestDto): Promise<StockResultDto> {
        return this.invokeServiceCall(data, `${id}/reverse`, Controllers.StockTransactions, HttpMethod.Post);
    }

    /** Runs the 30-day roll-up of Production and ProductionInput moves now (G3). */
    rollUp(): Promise<StockRollupResultDto> {
        return this.invokeServiceCall(null, 'rollup', Controllers.StockTransactions, HttpMethod.Post);
    }
}

export const stockTransactionClient = StockTransactionClient.getInstance();
