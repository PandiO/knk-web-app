import type { FieldValidationRuleDto } from '../../src/types/dtos/forms/FieldValidationRuleDtos';
import type { FormConfigurationDto, FormFieldDto, FormStepDto, FormSubmissionProgressDto } from '../../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { StepProgressReadDto, WorkflowSessionReadDto } from '../../src/types/dtos/workflow/WorkflowDtos';
import { FieldType } from '../../src/utils/enums';

/** A form configuration for the form wizard spec, typed with the app's DTOs (see e2e/fixtures/auth.ts). */

function field(values: Pick<FormFieldDto, 'id' | 'fieldName' | 'label' | 'fieldType' | 'order'> & Partial<FormFieldDto>): FormFieldDto {
  return {
    isRequired: false,
    isReadOnly: false,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...values,
  };
}

function step(values: Pick<FormStepDto, 'id' | 'stepName' | 'order' | 'fields'> & Partial<FormStepDto>): FormStepDto {
  return {
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: false,
    childFormSteps: [],
    conditions: [],
    ...values,
  };
}

/** "New town": step 1 asks for a required name and a description, step 2 whether players may enter. */
export const townForm: FormConfigurationDto = {
  id: '11',
  entityTypeName: 'Town',
  configurationName: 'Town (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '21',
      stepName: 'Basics',
      order: 0,
      fields: [
        field({ id: '31', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '32', fieldName: 'Description', label: 'Description', fieldType: FieldType.String, order: 1 }),
      ],
    }),
    step({
      id: '22',
      stepName: 'Access',
      order: 1,
      fields: [field({ id: '33', fieldName: 'AllowEntry', label: 'Allow entry', fieldType: FieldType.Boolean, order: 0 })],
    }),
  ],
};

export function workflowSession(userId: number, form: FormConfigurationDto): WorkflowSessionReadDto {
  return {
    id: 501,
    sessionGuid: '00000000-0000-0000-0000-000000000501',
    userId,
    formConfigurationId: Number(form.id),
    entityTypeName: form.entityTypeName.toLowerCase(),
    currentStepIndex: 0,
    status: 'InProgress',
    createdAt: '2026-11-14T10:00:00Z',
  };
}

/** What POST FormSubmissionProgress answers: the saved draft with its new id. */
export function savedProgress(sent: FormSubmissionProgressDto): FormSubmissionProgressDto {
  return { ...sent, id: '601' };
}

/** The type metadata of Town, enough for the wizard to type its fields. */
export const townMetadata: EntityMetadataDto = {
  entityName: 'Town',
  displayName: 'Town',
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Description', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'AllowEntry', fieldType: 'Boolean', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'false' },
  ],
};

export const noValidationRules: FieldValidationRuleDto[] = [];
export const noStepProgress: StepProgressReadDto[] = [];
