import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    LogisticsApplyTemplateDto,
    LogisticsPolicyDto,
    LogisticsPolicyListDto,
    LogisticsPolicyUpdateDto,
} from '../types/dtos/production/LogisticsDtos';
import { toPolicySave } from '../utils/logistics';

// Town logistics P9 (PandiO/knk-workspace#127 API, #686 web app; TOWN_LOGISTICS § 4, § 4.1): versioned policies
// (api/LogisticsPolicies) of a town, a warehouse, or a default template per town size and specialization (D-L3). A save
// is a new version with a new id; the old version stays for the history. Writes need knk.admin.world, deletes also
// knk.admin.delete. Refusals are 400 `{ error }` (every bad rule, "Rule 2: ...") or 409 (not the current version).
export class LogisticsPolicyClient extends ObjectManager {
    private static instance: LogisticsPolicyClient;

    public static getInstance() {
        if (!LogisticsPolicyClient.instance) {
            LogisticsPolicyClient.instance = new LogisticsPolicyClient();
            LogisticsPolicyClient.instance.logger = logging.getLogger('LogisticsPolicyClient');
        }
        return LogisticsPolicyClient.instance;
    }

    /** A version with its rules (each with its one-line `summary`). */
    getById(id: number): Promise<LogisticsPolicyDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LogisticsPolicies, HttpMethod.Get);
    }

    /** Current versions by default. Filters: `current` (true, false or all), `scope`, `townId`, `warehouseId`, `lineageId`, `specialization`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<LogisticsPolicyListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.LogisticsPolicies, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<LogisticsPolicyListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.LogisticsPolicies, HttpMethod.Post);
    }

    /** Every version of the policy's lineage, newest first. */
    versions(id: number): Promise<LogisticsPolicyListDto[]> {
        return this.invokeServiceCall(null, `${id}/versions`, Controllers.LogisticsPolicies, HttpMethod.Get);
    }

    /** A new policy (version 1); a town has one town policy, a warehouse one warehouse policy (409 otherwise). */
    create(data: LogisticsPolicyDto): Promise<LogisticsPolicyDto> {
        return this.invokeServiceCall(data, '', Controllers.LogisticsPolicies, HttpMethod.Post);
    }

    /** Saves the whole rule list as a new version and answers it (a new id). A template's specialization, size and
     *  default flag are taken from the request, so send them every time. 409 on a superseded version. */
    saveVersion(id: number, data: LogisticsPolicyUpdateDto): Promise<LogisticsPolicyDto> {
        return this.invokeServiceCall(data, `${id}`, Controllers.LogisticsPolicies, HttpMethod.Put);
    }

    /** The seeded form's edit (name, template labels): a new version that keeps the current rules, because a save
     *  without rules would empty the policy. */
    async updateKeepingRules(data: LogisticsPolicyDto): Promise<LogisticsPolicyDto> {
        const current = await this.getById(Number(data.id));
        const merged = { ...current, ...data, rules: current.rules };
        return this.saveVersion(Number(data.id), toPolicySave(merged, current.rules ?? [], data.reason && data.reason !== current.reason ? data.reason : 'Edited in the form.'));
    }

    /** Deletes the policy with every version. */
    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LogisticsPolicies, HttpMethod.Delete);
    }

    /** Copies a template's rules into the town's policy (a new version, or version 1) and answers the town policy. */
    applyTemplate(templateId: number, data: LogisticsApplyTemplateDto): Promise<LogisticsPolicyDto> {
        return this.invokeServiceCall(data, `${templateId}/apply`, Controllers.LogisticsPolicies, HttpMethod.Post);
    }

}

export const logisticsPolicyClient = LogisticsPolicyClient.getInstance();
