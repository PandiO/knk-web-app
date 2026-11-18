import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../src/types/dtos/forms/FormModels';
import type { LandmarkDto, LandmarkListDto } from '../../src/types/dtos/landmark/LandmarkDtos';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import { FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { accessMetadata, WORLD } from './dashboardAccess';

/**
 * Landmarks (off-road navigation phase 5.1, PandiO/knk-workspace#708) for e2e/landmarks.spec.ts, typed with the app's
 * DTOs: three landmarks in two worlds, two of them linked to the town Cinix (id 4), and the metadata the API sends
 * (World area, create and edit with knk.admin.world.landmark and knk.admin.content).
 */

export const LANDMARK = 'knk.admin.world.landmark';
export const CONTENT = 'knk.admin.content';

export const landmarkRows: LandmarkListDto[] = [
  {
    id: 1, name: 'Throne room', world: 'world', x: 100.4, y: 72, z: -40.6, domainId: 4, domainName: 'Cinix', domainType: 'Town',
    extentKind: 'Region', preference: 1, navigationEnabled: true, kind: 'General',
  },
  {
    id: 2, name: 'Market well', world: 'world', x: 12, y: 64, z: 8, domainId: 4, domainName: 'Cinix', domainType: 'Town',
    extentKind: 'Radius', preference: 0.8, navigationEnabled: false, kind: 'General',
  },
  {
    id: 3, name: 'Nether portal', world: 'world_nether', x: 0, y: 70, z: 0, domainId: null, domainName: null, domainType: null,
    extentKind: 'None', preference: 1, navigationEnabled: true, kind: 'General',
  },
];

export const throneRoom: LandmarkDto = {
  id: 1, name: 'Throne room', locationId: 31, world: 'world',
  location: { id: 31, name: 'Throne room', x: 100.4, y: 72, z: -40.6, yaw: 0, pitch: 0, world: 'world' },
  domainId: 4, domain: { id: 4, name: 'Cinix', domainType: 'Town', worldName: 'world' }, domainName: 'Cinix',
  extentKind: 'Region', regionId: 'throne_room', radius: null, preference: 1, navigationEnabled: true, kind: 'General',
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

/** `POST landmarks/search`: the search term matches name, world and domain; the domainId filter narrows. */
export function mockLandmarkSearch(api: MockApi, rows: LandmarkListDto[] = landmarkRows): void {
  api.on<PagedResultDto<LandmarkListDto>>('POST', 'landmarks/search', ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number; filters?: Record<string, string> };
    const term = (query.searchTerm ?? '').toLowerCase();
    const domainId = query.filters?.domainId;
    const items = rows
      .filter(r => !term || [r.name, r.world, r.domainName].some(v => (v ?? '').toLowerCase().includes(term)))
      .filter(r => !domainId || String(r.domainId) === domainId);
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
 * A one-step landmark form for the save path (the seed's Location and Domain pickers have specs of their own): name,
 * the area as a radius, the preference and whether /navigate offers it.
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
        field({ id: '74', fieldName: 'Radius', label: 'Radius (blocks)', fieldType: FieldType.Decimal, order: 1 }),
        field({ id: '75', fieldName: 'Preference', label: 'Route preference', fieldType: FieldType.Decimal, order: 2 }),
      ],
    }),
  ],
};

export const landmarkFormMetadata: EntityMetadataDto = {
  ...landmarkMetadata,
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Radius', fieldType: 'Double', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Preference', fieldType: 'Double', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '1' },
  ],
};
