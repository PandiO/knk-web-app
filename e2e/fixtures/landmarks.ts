import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type {
  DisplayConditionGroupDto,
  FormConfigurationDto,
  FormFieldDto,
  FormStepDto,
} from '../../src/types/dtos/forms/FormModels';
import type { DomainListDto } from '../../src/types/dtos/domain/DomainDtos';
import type { LandmarkDto, LandmarkListDto } from '../../src/types/dtos/landmark/LandmarkDtos';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import { ConditionOperator, DisplayConditionLogic, DisplayConditionTargetType, FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { accessMetadata, WORLD } from './dashboardAccess';

/**
 * Landmarks (off-road navigation phase 5.1, PandiO/knk-workspace#708) for e2e/landmarks.spec.ts, typed with the app's
 * DTOs (landmark-domain model, #986): three landmarks in two worlds, two of them with the town Cinix (id 4) as parent, and
 * the metadata the API sends
 * (World area, create and edit with knk.admin.world.landmark and knk.admin.content).
 */

export const LANDMARK = 'knk.admin.world.landmark';
export const CONTENT = 'knk.admin.content';

export const landmarkRows: LandmarkListDto[] = [
  {
    id: 1, name: 'Throne room', world: 'world', x: 100.4, y: 72, z: -40.6, parentDomainId: 4, parentDomainName: 'Cinix',
    parentDomainType: 'Town', areaKind: 'OwnRegion', wgRegionId: 'domain_1', preference: 1, navigationEnabled: true, kind: 'General',
  },
  {
    id: 2, name: 'Market well', world: 'world', x: 12, y: 64, z: 8, parentDomainId: 4, parentDomainName: 'Cinix',
    parentDomainType: 'Town', areaKind: 'LinkedDomain', wgRegionId: null, preference: 0.8, navigationEnabled: false, kind: 'General',
  },
  {
    id: 3, name: 'Nether portal', world: 'world_nether', x: 0, y: 70, z: 0, parentDomainId: null, parentDomainName: null,
    parentDomainType: null, areaKind: 'None', wgRegionId: null, preference: 1, navigationEnabled: true, kind: 'General',
  },
];

export const throneRoom: LandmarkDto = {
  id: 1, domainType: 'Landmark', name: 'Throne room', description: 'The king receives here.', locationId: 31, world: 'world',
  worldName: 'world',
  location: { id: 31, name: 'Throne room', x: 100.4, y: 72, z: -40.6, yaw: 0, pitch: 0, world: 'world' },
  areaKind: 'OwnRegion', wgRegionId: 'domain_1', subRegionIds: [], parentDomainId: 4,
  parentDomain: { id: 4, name: 'Cinix', domainType: 'Town', worldName: 'world', wgRegionId: 'town_cinix' },
  parentDomainName: 'Cinix', allowEntry: true, allowExit: true, showEnterLeaveMessages: false, teleportEnabled: false,
  preference: 1, navigationEnabled: true, kind: 'General',
};

export const landmarkMetadata: EntityMetadataDto = {
  ...accessMetadata('Landmark', WORLD),
  readNodes: [WORLD, LANDMARK],
  actionNodes: {
    view: [WORLD],
    create: [LANDMARK, CONTENT],
    edit: [LANDMARK, CONTENT],
    delete: [WORLD, 'knk.admin.delete'],
    bulkDelete: [WORLD, 'knk.admin.delete', 'knk.admin.delete.bulk'],
    export: [WORLD, 'knk.admin.export'],
  },
};

/** `POST landmarks/search`: the search term matches name, world and parent; the parentDomainId filter narrows. */
export function mockLandmarkSearch(api: MockApi, rows: LandmarkListDto[] = landmarkRows): void {
  api.on<PagedResultDto<LandmarkListDto>>('POST', 'landmarks/search', ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number; filters?: Record<string, string> };
    const term = (query.searchTerm ?? '').toLowerCase();
    const parentId = query.filters?.parentDomainId;
    const items = rows
      .filter(r => !term || [r.name, r.world, r.parentDomainName].some(v => (v ?? '').toLowerCase().includes(term)))
      .filter(r => !parentId || String(r.parentDomainId) === parentId);
    const page = query.pageNumber ?? query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return { body: { items, totalCount: items.length, page, pageSize, totalPages: 1 } };
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

/**
 * A one-step landmark form for the save path: name, description, the area and the preference (the seed's Location,
 * parent and region steps have specs of their own in e2e/landmark-domain.spec.ts).
 */
export const landmarkForm: FormConfigurationDto = {
  id: '71',
  entityTypeName: 'Landmark',
  configurationName: 'Landmark (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '72',
      stepName: 'Landmark',
      order: 0,
      fields: [
        field({ id: '73', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '74', fieldName: 'Description', label: 'Description', fieldType: FieldType.String, order: 1 }),
        field({
          id: '75', fieldName: 'AreaKind', label: 'Area', fieldType: FieldType.Enum, order: 2, defaultValue: 'None',
          settingsJson: JSON.stringify({ enumValues: ['None', 'OwnRegion', 'LinkedDomain'] }),
        }),
        field({ id: '76', fieldName: 'Preference', label: 'Route preference', fieldType: FieldType.Decimal, order: 3 }),
      ],
    }),
  ],
};

export const landmarkFormMetadata: EntityMetadataDto = {
  ...landmarkMetadata,
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Description', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'AreaKind', fieldType: 'LandmarkAreaKind', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'None' },
    { fieldName: 'Preference', fieldType: 'Double', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '1' },
  ],
};

// ===== Landmark-domain phase 4 (PandiO/knk-workspace#986): the form with the domain steps =====

const AREA_GUID = '11b2f868-53c0-5168-96a1-22188216ba5f';

/** "Only with Own region": the display condition the landmark form's area-dependent steps and fields carry (A17). */
const ownRegionOnly = (targetType: DisplayConditionTargetType): DisplayConditionGroupDto[] => [{
  targetType,
  innerLogic: DisplayConditionLogic.And,
  combineWithPreviousLogic: DisplayConditionLogic.And,
  order: 0,
  isActive: true,
  conditions: [{ sourceFieldGuid: AREA_GUID, operator: ConditionOperator.Equals, valueJson: JSON.stringify('OwnRegion'), order: 0 }],
}];

/**
 * The Landmark form of seed v2 (knk-web-api `Data/FormConfigurationSeeds/Landmark.json`, field names and steps), without
 * the Location step (its world task has specs of its own), with the area-dependent steps behind "Area = Own region"
 * (DESIGN § 4.1, A17).
 */
export const landmarkDomainForm: FormConfigurationDto = {
  id: '81',
  entityTypeName: 'Landmark',
  configurationName: 'Landmark - Default (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '82', stepName: 'Landmark', order: 0,
      fields: [
        field({ id: '83', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '84', fieldName: 'ParentDomainId', label: 'Parent', fieldType: FieldType.Object, objectType: 'Domain', order: 1 }),
      ],
    }),
    step({
      id: '85', stepName: 'Area', order: 1,
      fields: [
        field({
          id: '86', fieldGuid: AREA_GUID, fieldName: 'AreaKind', label: 'Area', fieldType: FieldType.Enum, order: 0, defaultValue: 'None',
          settingsJson: JSON.stringify({ enumValues: ['None', 'OwnRegion', 'LinkedDomain'] }),
        }),
        field({
          id: '87', fieldName: 'WgRegionId', label: 'Region', fieldType: FieldType.String, order: 1,
          displayConditionGroups: ownRegionOnly(DisplayConditionTargetType.FormField),
        }),
      ],
    }),
    step({
      id: '88', stepName: 'Access and messages', order: 2, displayConditionGroups: ownRegionOnly(DisplayConditionTargetType.FormStep),
      fields: [
        field({ id: '89', fieldName: 'AllowEntry', label: 'Allow entry', fieldType: FieldType.Boolean, order: 0, defaultValue: 'True' }),
        field({ id: '90', fieldName: 'ShowEnterLeaveMessages', label: 'Show enter and leave messages', fieldType: FieldType.Boolean, order: 1 }),
      ],
    }),
    step({
      id: '91', stepName: 'Warp destination', order: 3, displayConditionGroups: ownRegionOnly(DisplayConditionTargetType.FormStep),
      fields: [field({ id: '92', fieldName: 'TeleportEnabled', label: 'Warp destination', fieldType: FieldType.Boolean, order: 0 })],
    }),
    step({
      id: '93', stepName: 'Sub-regions', order: 4, displayConditionGroups: ownRegionOnly(DisplayConditionTargetType.FormStep),
      fields: [field({ id: '94', fieldName: 'Kind', label: 'Kind', fieldType: FieldType.String, order: 0 })],
    }),
  ],
};

export const landmarkDomainFormMetadata: EntityMetadataDto = {
  ...landmarkMetadata,
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'ParentDomainId', fieldType: 'Int32', isNullable: true, isRelatedEntity: true, relatedEntityType: 'Domain', hasDefaultValue: false },
    { fieldName: 'AreaKind', fieldType: 'LandmarkAreaKind', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'None' },
    { fieldName: 'WgRegionId', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'AllowEntry', fieldType: 'Boolean', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'True' },
    { fieldName: 'ShowEnterLeaveMessages', fieldType: 'Boolean', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'False' },
    { fieldName: 'TeleportEnabled', fieldType: 'Boolean', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'False' },
    { fieldName: 'Kind', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'General' },
  ],
};

/** Domain search rows (`POST api/Domains/search`): every type, two landmarks among them (tower 1 with "Dais" 5 below). */
export const domainRows: DomainListDto[] = [
  { id: 4, name: 'Cinix', description: 'A town', wgRegionId: 'town_cinix', worldName: 'world', domainType: 'Town' },
  { id: 6, name: 'East gate', description: 'A gate', wgRegionId: 'gate_east', worldName: 'world', domainType: 'GateStructure' },
  { id: 1, name: 'Throne room', description: 'A landmark', wgRegionId: 'domain_1', worldName: 'world', domainType: 'Landmark', parentDomainId: 4 },
  { id: 3, name: 'Nether portal', description: 'A point', wgRegionId: null, worldName: 'world_nether', domainType: 'Landmark' },
  { id: 5, name: 'Dais', description: 'Inside the throne room', wgRegionId: null, worldName: 'world', domainType: 'Landmark', parentDomainId: 1 },
];

/**
 * `POST Domains/search` as knk-web-api answers it (L2, #984): the search term on the name, `domainType` (exact types,
 * comma separated) and `excludeSubtreeOf` (the landmark and the landmarks below it).
 */
export function mockDomainSearch(api: MockApi, rows: DomainListDto[] = domainRows): void {
  api.on<PagedResultDto<DomainListDto>>('POST', 'Domains/search', ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number; filters?: Record<string, string> };
    const term = (query.searchTerm ?? '').toLowerCase();
    const types = (query.filters?.domainType ?? '').split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
    const root = Number(query.filters?.excludeSubtreeOf ?? 0);
    const excluded = new Set<number>();
    if (root > 0) {
      excluded.add(root);
      let grew = true;
      while (grew) {
        grew = false;
        for (const r of rows) {
          if (r.id != null && !excluded.has(r.id) && r.parentDomainId != null && excluded.has(r.parentDomainId)) {
            excluded.add(r.id);
            grew = true;
          }
        }
      }
    }
    const items = rows
      .filter(r => !term || r.name.toLowerCase().includes(term))
      .filter(r => types.length === 0 || types.includes(r.domainType.toLowerCase()))
      .filter(r => r.id == null || !excluded.has(r.id));
    const page = query.pageNumber ?? query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return { body: { items, totalCount: items.length, page, pageSize, totalPages: 1 } };
  });
}
