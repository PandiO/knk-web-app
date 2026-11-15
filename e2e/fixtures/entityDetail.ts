import type { RelationshipChangeResultDto } from '../../src/apiClients/relationshipClient';
import type { LookupItemDto, LookupSearchResponseDto } from '../../src/apiClients/lookupClient';
import type { DisplayConfigurationDto, DisplayFieldDto, DisplaySectionDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { MockApi } from '../support/mockApi';
import { accessMetadata, CONTENT, metadata, WORLD } from './dashboardAccess';

/**
 * Detail pages for e2e/entity-detail.spec.ts (PandiO/knk-workspace#188, #189, backfill #511):
 * 1. a district's (`/display/District/1`): a hot-edit Name and a Streets collection (View, Add, Unlink, Delete), the
 *    link-table example (`storage: 'many'`); the relationship endpoints change `district.streets`, so the page's reload
 *    shows the result;
 * 2. a town's (`/display/Town/1`): a hot-edit Name and its Streets, which are derived from its districts since #409
 *    (read-only, no relationship endpoints).
 */

interface StreetRow {
  id: number;
  name: string;
}

export interface RecordDetail {
  id: number;
  name: string;
  streets: StreetRow[];
}

const field = (fieldGuid: string, label: string, fieldName: string, extra: Partial<DisplayFieldDto> = {}): DisplayFieldDto => ({
  fieldGuid,
  label,
  fieldName,
  isReusable: false,
  isLinkedToSource: false,
  ...extra,
});

const section = (sectionGuid: string, sectionName: string, extra: Partial<DisplaySectionDto>): DisplaySectionDto => ({
  sectionGuid,
  sectionName,
  isReusable: false,
  isLinkedToSource: false,
  isCollection: false,
  fields: [],
  subSections: [],
  ...extra,
});

function displayOf(entityTypeName: 'Town' | 'District', id: string): DisplayConfigurationDto {
  return {
    id,
    name: `${entityTypeName} display`,
    entityTypeName,
    isDefault: true,
    isDraft: false,
    sections: [
      section('s0', entityTypeName, { fields: [field('f0', 'Name', 'name', { isEditableInDisplay: true, fieldType: 'String' })] }),
      section('s1', 'Streets', {
        isCollection: true,
        relatedEntityPropertyName: 'Streets',
        relatedEntityTypeName: 'Street',
        actionButtonsConfigJson: JSON.stringify({ showViewButton: true, showAddButton: true, showUnlinkButton: true, showRemoveButton: true, showDeleteButton: true }),
        fields: [field('f1', 'Name', 'name')],
      }),
    ],
  };
}

export const townDisplay = displayOf('Town', '11');
export const districtDisplay = displayOf('District', '12');

/** A district's streets are a link table: Add… and Unlink change it (#188; the area node and content since #374). */
export const districtMetadata: EntityMetadataDto = {
  ...accessMetadata('District', WORLD),
  lookupGettable: true,
  relationships: [
    { property: 'streets', relatedType: 'Street', kind: 'collection', storage: 'many', canLink: true, canUnlink: true, nodes: [WORLD, CONTENT] },
  ],
};

export const allStreets: StreetRow[] = [
  { id: 1, name: 'Main Street' },
  { id: 2, name: 'Market Lane' },
  { id: 3, name: 'Harbour Road' },
  ...Array.from({ length: 12 }, (_, i) => ({ id: 10 + i, name: `Lane ${i + 1}` })),
];

const firstStreets = (count: number) => allStreets.filter(s => s.id !== 2).slice(0, count);

/** Town 1 "Cinix" with `streetCount` streets (derived, read-only) and a Name that saves through PUT. Returns the live town. */
export function mockTownDetail(api: MockApi, streetCount = 2): RecordDetail {
  const town: RecordDetail = { id: 1, name: 'Cinix', streets: firstStreets(streetCount) };
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Town', townDisplay);
  api.on<RecordDetail>('GET', 'Towns/1', () => ({ body: { ...town, streets: [...town.streets] } }));
  api.on<RecordDetail>('PUT', 'Towns/1', ({ body }) => {
    Object.assign(town, body as Partial<RecordDetail>);
    return { body: town };
  });
  api.json<LookupItemDto>('GET', 'Lookup/Town/1', { id: 1, label: 'Cinix' });
  return town;
}

/**
 * District 1 "Old Quarter" with `streetCount` streets; link and unlink change them, the street lookup searches all
 * streets. Adds the District metadata to the dashboard types' (call after `mockDashboardTypes`). Returns the live district.
 */
export function mockDistrictDetail(api: MockApi, streetCount = 2): RecordDetail {
  const district: RecordDetail = { id: 1, name: 'Old Quarter', streets: firstStreets(streetCount) };
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [...metadata, districtMetadata]);
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/District', districtDisplay);
  api.on<RecordDetail>('GET', 'Districts/1', () => ({ body: { ...district, streets: [...district.streets] } }));
  api.on<RecordDetail>('PUT', 'Districts/1', ({ body }) => {
    Object.assign(district, body as Partial<RecordDetail>);
    return { body: district };
  });
  api.on<RelationshipChangeResultDto>('POST', 'Relationships/District/1/streets/unlink', ({ body }) => {
    const relatedId = (body as { relatedId: number }).relatedId;
    district.streets = district.streets.filter(s => s.id !== relatedId);
    return { body: { entityType: 'District', id: 1, property: 'streets', relatedId, changed: true } };
  });
  api.on<RelationshipChangeResultDto>('POST', 'Relationships/District/1/streets/link', ({ body }) => {
    const relatedId = (body as { relatedId: number }).relatedId;
    const street = allStreets.find(s => s.id === relatedId);
    if (street && !district.streets.some(s => s.id === relatedId)) district.streets.push(street);
    return { body: { entityType: 'District', id: 1, property: 'streets', relatedId, changed: true } };
  });
  api.on<LookupSearchResponseDto>('POST', 'Lookup/Street/search', ({ body }) => {
    const term = ((body as { searchTerm?: string | null }).searchTerm ?? '').toLowerCase();
    const items: LookupItemDto[] = allStreets.filter(s => s.name.toLowerCase().includes(term)).slice(0, 10).map(s => ({ id: s.id, label: s.name }));
    return { body: { items, total: items.length } };
  });
  api.json<LookupItemDto>('GET', 'Lookup/District/1', { id: 1, label: 'Old Quarter' });
  return district;
}
