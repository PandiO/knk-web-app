export class UIFieldConfigurationDTO {
    id: number;
    objectType: string;
    fieldName: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    optionsEndpoint?: string;
    readonly: boolean;

    constructor(data: Partial<UIFieldConfigurationDTO>) {
        this.id = data.id || 0;
        this.objectType = data.objectType || '';
        this.fieldName = data.fieldName || '';
        this.label = data.label || '';
        this.type = data.type || '';
        this.required = data.required || false;
        this.placeholder = data.placeholder;
        this.optionsEndpoint = data.optionsEndpoint;
        this.readonly = data.readonly || false;
    }

    static fromApi(data: any): UIFieldConfigurationDTO {
        return new UIFieldConfigurationDTO({
            id: data.id,
            objectType: data.objectType,
            fieldName: data.fieldName,
            label: data.label,
            type: data.type,
            required: data.required,
            placeholder: data.placeholder,
            optionsEndpoint: data.optionsEndpoint,
            readonly: data.readonly,
        });
    }

    toApi(): any {
        return {
            id: this.id,
            objectType: this.objectType,
            fieldName: this.fieldName,
            label: this.label,
            type: this.type,
            required: this.required,
            placeholder: this.placeholder,
            optionsEndpoint: this.optionsEndpoint,
            readonly: this.readonly,
        };
    }
}
