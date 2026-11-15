import type { FieldValidationRuleDto } from '../../src/types/dtos/forms/FieldValidationRuleDtos';
import type {
  FormConfigurationBuilderState,
  FormConfigurationDto,
  FormFieldDto,
  FormStepDto,
  FormSubmissionProgressDto,
} from '../../src/types/dtos/forms/FormModels';
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

/**
 * "New structure" (#290): one step with an Object List field of districts, so the "Selected (n):"
 * cards above the picker can be checked at phone width.
 */
export const structureForm: FormConfigurationDto = {
  id: '12',
  entityTypeName: 'Structure',
  configurationName: 'Structure (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '23',
      stepName: 'Districts',
      order: 0,
      fields: [
        field({
          id: '34',
          fieldName: 'Districts',
          label: 'Districts',
          fieldType: FieldType.List,
          elementType: FieldType.Object,
          objectType: 'District',
          order: 0,
        }),
      ],
    }),
  ],
};

/** The type metadata of Structure, enough for the wizard to type its Districts field. */
export const structureMetadata: EntityMetadataDto = {
  entityName: 'Structure',
  displayName: 'Structure',
  fields: [
    { fieldName: 'Districts', fieldType: 'List', isNullable: true, isRelatedEntity: true, relatedEntityType: 'District', hasDefaultValue: false },
  ],
};

/**
 * PandiO/knk-workspace#291: the form builder opened on "Town (e2e)" with a saved draft that adds a field
 * "Spawn point" to Basics. The field only exists in the draft (no id yet, a GUID), and neither version has
 * validation rules.
 */
export const townBuilderState: FormConfigurationBuilderState = (() => {
  const published: FormConfigurationDto = {
    ...townForm,
    steps: townForm.steps.map((s, i) => ({ ...s, stepGuid: `0000000${i + 1}-0000-0000-0000-000000000021` })),
    validationRules: [],
  };
  const spawn = field({
    id: 'temp-spawn',
    fieldGuid: '00000000-0000-0000-0000-000000000099',
    fieldName: 'Description',
    label: 'Spawn point',
    fieldType: FieldType.String,
    order: 2,
  });
  const working: FormConfigurationDto = {
    ...published,
    hasUnpublishedChanges: true,
    steps: published.steps.map((s, i) => (i === 0 ? { ...s, fields: [...s.fields, spawn] } : s)),
    validationRules: [],
  };
  return {
    configuration: working,
    published,
    isPublished: true,
    hasUnpublishedChanges: true,
    draftSavedAt: '2026-11-15T10:00:00Z',
    publishedAt: '2026-11-14T10:00:00Z',
    openDraftCount: 0,
  };
})();

/**
 * PandiO/knk-workspace#288: "New siege objective" with one Object field, the team that holds the objective at the
 * start. Its pickerFilters narrow the team picker to scenario 100's teams (a literal here; the real form takes the
 * scenario from the parent record).
 */
export const siegeObjectiveForm: FormConfigurationDto = {
  id: '13',
  entityTypeName: 'SiegeObjective',
  configurationName: 'Siege objective (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '24',
      stepName: 'Holder',
      order: 0,
      fields: [
        field({
          id: '35',
          fieldName: 'InitialHolderTeam',
          label: 'Initial holder team',
          fieldType: FieldType.Object,
          objectType: 'SiegeTeam',
          order: 0,
          settingsJson: '{"pickerFilters":{"siegeScenarioId":"100"}}',
        }),
      ],
    }),
  ],
};

/** The type metadata of SiegeObjective, enough for the wizard to type its team field. */
export const siegeObjectiveMetadata: EntityMetadataDto = {
  entityName: 'SiegeObjective',
  displayName: 'Siege objective',
  fields: [
    {
      fieldName: 'InitialHolderTeam',
      fieldType: 'Object',
      isNullable: true,
      isRelatedEntity: true,
      relatedEntityType: 'SiegeTeam',
      hasDefaultValue: false,
    },
  ],
};

/** The read node of siege teams (knk-web-api `StaffPermissions.SiegeManage`). */
export const SIEGE_MANAGE = 'knk.siege.admin.manage';

/** SiegeTeam in the base metadata: read in full with the siege node, otherwise through api/Lookup. */
export const siegeTeamMetadata: EntityMetadataDto = {
  entityName: 'SiegeTeam',
  displayName: 'Siege team',
  fields: [],
  readNodes: [SIEGE_MANAGE],
  lookupSearchable: true,
  lookupGettable: true,
};
