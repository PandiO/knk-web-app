import { Controllers, FormConfigurationOperation, HttpMethod } from "../utils/enums";
import { 
    FormConfigurationBuilderState,
    FormConfigurationDto, 
    FormStepDto, 
    FormFieldDto,
    AddReusableStepRequestDto,
    AddReusableFieldRequestDto
} from "../types/dtos/forms/FormModels";
import {
    FormConfigurationImportOptions,
    FormConfigurationImportResult,
    FormConfigurationSeed,
    PortableFormConfiguration
} from "../types/dtos/forms/FormPortabilityModels";
import { ObjectManager } from "./objectManager";
import { logging } from "../utils";
import { serviceCall } from "../services/serviceCall";
import ConfigurationHelper from "../utils/config-helper";

export class FormConfigClient extends ObjectManager {
    private static instance: FormConfigClient;

    public static getInstance() {
        if (!FormConfigClient.instance) {
            FormConfigClient.instance = new FormConfigClient();
            FormConfigClient.instance.logger = logging.getLogger('FormConfigClient');
        }
        return FormConfigClient.instance;
    }

    getAll(): Promise<FormConfigurationDto[]> {
        return this.invokeServiceCall(null, FormConfigurationOperation.GetAll, Controllers.FormConfigurations, HttpMethod.Get);
    }

    getById(id: string): Promise<FormConfigurationDto> {
        return this.invokeServiceCall(null, `${FormConfigurationOperation.GetById}${id}`, Controllers.FormConfigurations, HttpMethod.Get);
    }

    /**
     * The entity's default (defaultOnly) or all its configurations. `includeDrafts` (#71): also the ones never
     * published, for Entity setup's list; the wizard, "New with" and pickers never ask for them.
     */
    getByEntityTypeName(entityName: string, defaultOnly: boolean = true, includeDrafts: boolean = false): Promise<FormConfigurationDto | FormConfigurationDto[] | undefined> {
        return this.invokeServiceCall(
            includeDrafts ? { defaultOnly, includeDrafts } : { defaultOnly },
            entityName,
            Controllers.FormConfigurations,
            HttpMethod.Get
        );
    }

    getByEntityAll(entityName: string): Promise<FormConfigurationDto[]> {
        return this.invokeServiceCall(
            { entityName },
            FormConfigurationOperation.GetByEntityAll,
            Controllers.FormConfigurations,
            HttpMethod.Get
        );
    }

    getEntityNames(): Promise<string[]> {
        return this.invokeServiceCall(
            null,
            FormConfigurationOperation.GetEntityNames,
            Controllers.FormConfigurations,
            HttpMethod.Get
        );
    }

    create(data: FormConfigurationDto): Promise<FormConfigurationDto> {
        return this.invokeServiceCall(data, FormConfigurationOperation.Create, Controllers.FormConfigurations, HttpMethod.Post);
    }

    update(data: FormConfigurationDto): Promise<FormConfigurationDto> {
        if (!data.id) {
            throw new Error('FormConfigurationDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id, Controllers.FormConfigurations, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, `${FormConfigurationOperation.Delete}${id}`, Controllers.FormConfigurations, HttpMethod.Delete);
    }

    // Template-related operations
    getReusableSteps(): Promise<FormStepDto[]> {
        return this.invokeServiceCall(
            null, 
            'reusable-steps', 
            Controllers.FormConfigurations, 
            HttpMethod.Get
        );
    }

    getReusableFields(): Promise<FormFieldDto[]> {
        return this.invokeServiceCall(
            null, 
            'reusable-fields', 
            Controllers.FormConfigurations, 
            HttpMethod.Get
        );
    }

    addReusableStepToConfiguration(configId: string, payload: AddReusableStepRequestDto): Promise<FormStepDto> {
        return this.invokeServiceCall(
            payload, 
            `${configId}/steps/add-from-template`, 
            Controllers.FormConfigurations, 
            HttpMethod.Post
        );
    }

    addReusableFieldToStep(stepId: string, payload: AddReusableFieldRequestDto): Promise<FormFieldDto> {
        return this.invokeServiceCall(
            payload, 
            `steps/${stepId}/fields/add-from-template`, 
            Controllers.FormConfigurations, 
            HttpMethod.Post
        );
    }

    // PandiO/knk-workspace#71: the builder's draft, Publish and Duplicate

    /** The working copy (saved draft, else the published version) and the published version. */
    getBuilderState(id: string): Promise<FormConfigurationBuilderState> {
        return this.invokeServiceCall(null, `${id}/builder`, Controllers.FormConfigurations, HttpMethod.Get);
    }

    /** A new configuration, saved as a draft only (never published). */
    createDraft(data: FormConfigurationDto): Promise<FormConfigurationBuilderState> {
        return this.invokeServiceCall(data, 'drafts', Controllers.FormConfigurations, HttpMethod.Post);
    }

    /** Saves the working copy; the wizard keeps using the published version. */
    saveDraft(id: string, data: FormConfigurationDto): Promise<FormConfigurationBuilderState> {
        return this.invokeServiceCall(data, `${id}/draft`, Controllers.FormConfigurations, HttpMethod.Put);
    }

    discardDraft(id: string): Promise<FormConfigurationBuilderState> {
        return this.invokeServiceCall(null, `${id}/draft/discard`, Controllers.FormConfigurations, HttpMethod.Post);
    }

    /** Applies the working copy with every save check; from then on the wizard uses it. */
    publish(id: string): Promise<FormConfigurationDto> {
        return this.invokeServiceCall(null, `${id}/publish`, Controllers.FormConfigurations, HttpMethod.Post);
    }

    /** A copy of the published version as a new draft; without a name "<name> (copy)". */
    duplicate(id: string, name?: string): Promise<FormConfigurationBuilderState> {
        return this.invokeServiceCall({ name: name?.trim() || null }, `${id}/duplicate`, Controllers.FormConfigurations, HttpMethod.Post);
    }

    // KNG-138: portable export/import and bundled seeds

    /** The configuration as a portable "knk-formconfig/1" file. */
    exportConfiguration(id: string): Promise<PortableFormConfiguration> {
        return this.invokeServiceCall(null, `${id}/export`, Controllers.FormConfigurations, HttpMethod.Get);
    }

    getSeeds(): Promise<FormConfigurationSeed[]> {
        return this.invokeServiceCall(null, 'seeds', Controllers.FormConfigurations, HttpMethod.Get);
    }

    /** Import (or dry-run) a file. Resolves with the result for Invalid/AlreadyImported too (400/409 carry it). */
    importConfiguration(file: PortableFormConfiguration, options: FormConfigurationImportOptions): Promise<FormConfigurationImportResult> {
        return this.invokeImport(`import?${importQuery(options)}`, file);
    }

    importSeed(name: string, options: FormConfigurationImportOptions): Promise<FormConfigurationImportResult> {
        return this.invokeImport(`seeds/${encodeURIComponent(name)}/import?${importQuery(options)}`, {});
    }

    /**
     * Like invokeServiceCall, but an import's refusal (400 Invalid, 409 AlreadyImported) is a normal
     * answer shown in the import panel, so it resolves with the result instead of raising the global
     * error toast. Other failures (403, 404, network) still reject.
     */
    private invokeImport(operation: string, data: unknown): Promise<FormConfigurationImportResult> {
        return new Promise((resolve, reject) => {
            serviceCall.invokeApiService({
                operation,
                controller: Controllers.FormConfigurations,
                httpMethod: HttpMethod.Post,
                fetchApiUrl: ConfigurationHelper.gatewayApiUrl,
                requestData: data,
                responseHandler: {
                    success: (result: FormConfigurationImportResult) => resolve(result),
                    error: (err: any) => {
                        const body = err?.response;
                        if (body && typeof body === 'object' && typeof body.status === 'string' && Array.isArray(body.errors)) {
                            resolve(body as FormConfigurationImportResult);
                        } else {
                            reject(err);
                        }
                    }
                }
            });
        });
    }
}

const importQuery = (options: FormConfigurationImportOptions) =>
    `dryRun=${options.dryRun ? 'true' : 'false'}&makeDefault=${options.makeDefault ? 'true' : 'false'}`;

export const formConfigClient = FormConfigClient.getInstance();

