import { logging, Controllers, HttpMethod, GradeOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { GradeDto } from "../types/dtos/grade/GradeDtos";
import { ObjectManager } from "./objectManager";

export class GradeClient extends ObjectManager {
    private static instance: GradeClient;

    public static getInstance() {
        if (!GradeClient.instance) {
            GradeClient.instance = new GradeClient();
            GradeClient.instance.logger = logging.getLogger('GradeClient');
        }
        return GradeClient.instance;
    }

    getAll(): Promise<GradeDto[]> {
        return this.invokeServiceCall(null, GradeOperation.GetAll, Controllers.Grades, HttpMethod.Get);
    }

    getById(id: string): Promise<GradeDto> {
        return this.invokeServiceCall(null, `${GradeOperation.GetById}${id}`, Controllers.Grades, HttpMethod.Get);
    }

    public create(data: GradeDto): Promise<GradeDto> {
        return this.invokeServiceCall(data, GradeOperation.Create, Controllers.Grades, HttpMethod.Post);
    }

    public update(data: GradeDto): Promise<GradeDto> {
        if (!data.id) {
            throw new Error('GradeDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id, Controllers.Grades, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, id, Controllers.Grades, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, GradeOperation.SearchPaged, Controllers.Grades, HttpMethod.Post);
    }
}

export const gradeClient = GradeClient.getInstance();
