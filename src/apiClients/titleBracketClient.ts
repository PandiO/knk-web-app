import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { TitleBracketDto } from '../types/dtos/title/TitleBracketDto';

// Read-only title-bracket lookup (seeded reference data) for the FormWizard's TitleBracket object
// picker - e.g. a Town/District/Structure's minimum title for warps (docs/specs/teleport, Phase 5).
// There is no create/update/delete endpoint.
export class TitleBracketClient extends ObjectManager {
    private static instance: TitleBracketClient;

    public static getInstance() {
        if (!TitleBracketClient.instance) {
            TitleBracketClient.instance = new TitleBracketClient();
            TitleBracketClient.instance.logger = logging.getLogger('TitleBracketClient');
        }
        return TitleBracketClient.instance;
    }

    getById(id: number): Promise<TitleBracketDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.TitleBrackets, HttpMethod.Get);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<TitleBracketDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.TitleBrackets, HttpMethod.Post);
    }
}

export const titleBracketClient = TitleBracketClient.getInstance();
