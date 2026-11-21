import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { PermissionGroupDto, PermissionGroupListDto } from '../../src/types/dtos/userManagement/PermissionGroupDto';
import { FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { permissionGroupMetadata } from './groupGrants';

/**
 * A permission group's default /navigate route mode (PandiO/knk-workspace#852) for e2e/permission-group-route-mode.spec.ts:
 * three groups on the dashboard (Staff efficient, Noble preferred, Default without one) and a one-step group form with
 * the seed's "Default route mode" field (knk-web-api Data/FormConfigurationSeeds/PermissionGroup.json, step Group).
 */

export const STAFF_ID = 40;

export const groupRows: PermissionGroupListDto[] = [
  { id: STAFF_ID, name: 'Staff', weight: 40, isPremiumTier: false, salaryMultiplier: 1, gemBonusMultiplier: 1, expBonusMultiplier: 1, parentGroupId: null, parentGroupName: null, defaultRouteMode: 'Efficient', childrenCount: 0 },
  { id: 20, name: 'Noble', weight: 20, isPremiumTier: true, salaryMultiplier: 1.5, gemBonusMultiplier: 1, expBonusMultiplier: 1, parentGroupId: 1, parentGroupName: 'Default', defaultRouteMode: 'Preferred', childrenCount: 0 },
  { id: 1, name: 'Default', weight: 0, isPremiumTier: false, salaryMultiplier: 1, gemBonusMultiplier: 1, expBonusMultiplier: 1, parentGroupId: null, parentGroupName: null, defaultRouteMode: null, childrenCount: 1 },
];

export const staff: PermissionGroupDto = {
  id: STAFF_ID, name: 'Staff', weight: 40, isPremiumTier: false, salaryMultiplier: 1, gemBonusMultiplier: 1, expBonusMultiplier: 1,
  parentGroupId: null, defaultRouteMode: 'Efficient',
};

/** `POST PermissionGroups/search`: every row, one page. */
export function mockGroupSearch(api: MockApi, rows: PermissionGroupListDto[] = groupRows): void {
  api.on<PagedResultDto<PermissionGroupListDto>>('POST', 'PermissionGroups/search', ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number };
    return { body: { items: rows, totalCount: rows.length, page: query.pageNumber ?? query.page ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
  });
}

function field(values: Pick<FormFieldDto, 'id' | 'fieldName' | 'label' | 'fieldType' | 'order'> & Partial<FormFieldDto>): FormFieldDto {
  return { isRequired: false, isReadOnly: false, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...values };
}

function step(values: Pick<FormStepDto, 'id' | 'stepName' | 'order' | 'fields'> & Partial<FormStepDto>): FormStepDto {
  return {
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, isManyToManyRelationship: false,
    childFormSteps: [], conditions: [], ...values,
  };
}

/** The seed's field, as the API sends it: an Enum dropdown of the three mode names with a named empty option. */
export const routeModeField = field({
  id: '83',
  fieldName: 'DefaultRouteMode',
  label: 'Default route mode',
  fieldType: FieldType.Enum,
  order: 2,
  settingsJson: JSON.stringify({ enumValues: ['Shortest', 'Efficient', 'Preferred'], emptyOptionLabel: 'None (default: Preferred)' }),
});

export const groupForm: FormConfigurationDto = {
  id: '81',
  entityTypeName: 'PermissionGroup',
  configurationName: 'PermissionGroup (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '82',
      stepName: 'Group',
      order: 0,
      fields: [
        field({ id: '84', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '85', fieldName: 'Weight', label: 'Weight', fieldType: FieldType.Integer, isRequired: true, order: 1, defaultValue: '0' }),
        routeModeField,
      ],
    }),
  ],
};

export const groupFormMetadata: EntityMetadataDto = {
  ...permissionGroupMetadata,
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Weight', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    {
      fieldName: 'DefaultRouteMode', fieldType: 'Enum', isNullable: true, isRelatedEntity: false, hasDefaultValue: false,
      isEnum: true, enumTypeName: 'RouteMode', enumValues: ['Shortest', 'Efficient', 'Preferred'],
    },
  ],
};
