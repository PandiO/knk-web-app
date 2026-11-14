import type { RelationshipChangeResultDto } from '../../src/apiClients/relationshipClient';
import type { LookupItemDto, LookupSearchResponseDto } from '../../src/apiClients/lookupClient';
import type { DisplayConfigurationDto, DisplayFieldDto, DisplaySectionDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { MockApi } from '../support/mockApi';

/**
 * A town's detail page (`/display/Town/1`, PandiO/knk-workspace#188, #189): the Town display configuration with
 * a hot-edit Name, a Streets collection (View, Add, Unlink, Delete) and the town as the API returns it. The
 * relationship endpoints change `town.streets`, so the page's reload shows the result (backfill #511).
 */

interface StreetRow {
  id: number;
  name: string;
}

export interface TownDetail {
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

export const townDisplay: DisplayConfigurationDto = {
  id: '11',
  name: 'Town display',
  entityTypeName: 'Town',
  isDefault: true,
  isDraft: false,
  sections: [
    section('s0', 'Town', { fields: [field('f0', 'Name', 'name', { isEditableInDisplay: true, fieldType: 'String' })] }),
    section('s1', 'Streets', {
      isCollection: true,
      relatedEntityPropertyName: 'Streets',
      relatedEntityTypeName: 'Street',
      actionButtonsConfigJson: JSON.stringify({ showViewButton: true, showAddButton: true, showUnlinkButton: true, showRemoveButton: true, showDeleteButton: true }),
      fields: [field('f1', 'Name', 'name')],
    }),
  ],
};

export const allStreets: StreetRow[] = [
  { id: 1, name: 'Main Street' },
  { id: 2, name: 'Market Lane' },
  { id: 3, name: 'Harbour Road' },
  ...Array.from({ length: 12 }, (_, i) => ({ id: 10 + i, name: `Lane ${i + 1}` })),
];

/** Town 1 "Cinix" with `streetCount` streets; the street lookup searches all streets. Returns the live town. */
export function mockTownDetail(api: MockApi, streetCount = 2): TownDetail {
  const town: TownDetail = { id: 1, name: 'Cinix', streets: allStreets.filter(s => s.id !== 2).slice(0, streetCount) };
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Town', townDisplay);
  api.on<TownDetail>('GET', 'Towns/1', () => ({ body: { ...town, streets: [...town.streets] } }));
  api.on<TownDetail>('PUT', 'Towns/1', ({ body }) => {
    Object.assign(town, body as Partial<TownDetail>);
    return { body: town };
  });
  api.on<RelationshipChangeResultDto>('POST', 'Relationships/Town/1/streets/unlink', ({ body }) => {
    const relatedId = (body as { relatedId: number }).relatedId;
    town.streets = town.streets.filter(s => s.id !== relatedId);
    return { body: { entityType: 'Town', id: 1, property: 'streets', relatedId, changed: true } };
  });
  api.on<RelationshipChangeResultDto>('POST', 'Relationships/Town/1/streets/link', ({ body }) => {
    const relatedId = (body as { relatedId: number }).relatedId;
    const street = allStreets.find(s => s.id === relatedId);
    if (street && !town.streets.some(s => s.id === relatedId)) town.streets.push(street);
    return { body: { entityType: 'Town', id: 1, property: 'streets', relatedId, changed: true } };
  });
  api.on<LookupSearchResponseDto>('POST', 'Lookup/Street/search', ({ body }) => {
    const term = ((body as { searchTerm?: string | null }).searchTerm ?? '').toLowerCase();
    const items: LookupItemDto[] = allStreets.filter(s => s.name.toLowerCase().includes(term)).slice(0, 10).map(s => ({ id: s.id, label: s.name }));
    return { body: { items, total: items.length } };
  });
  api.json<LookupItemDto>('GET', 'Lookup/Town/1', { id: 1, label: 'Cinix' });
  return town;
}
