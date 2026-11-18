import type { MockApi } from '../support/mockApi';
import type { DisplayConfigurationDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { MapStructurePanelDto } from '../../src/types/dtos/map/MapDtos';
import type { StructureDto } from '../../src/types/dtos/structure/StructureDto';

/**
 * Staff details in the map panel (PandiO/knk-workspace#740, A17): the Bakery (structure 10, not a gate) with its
 * public panel, the Structure display configuration (a General section with a hot-editable name, the district as a
 * related record with buttons, and its locations as a collection) and the record.
 */

const world = ['knk.admin.world'];

export const bakeryPanel: MapStructurePanelDto = {
  id: 10, name: 'Bakery', description: 'Fresh bread every morning.', type: 'Structure', subtype: null,
  districtName: 'Old Market', townName: 'Aldmoor', streetName: 'Market Street', houseNumber: 3, gate: null,
};

export const structureMetadata: EntityMetadataDto[] = [
  {
    entityName: 'Structure', displayName: 'Structure', fields: [], readNodes: world, lookupGettable: true,
    actionNodes: { edit: [...world, 'knk.admin.content'], delete: [...world, 'knk.admin.delete'] },
    relationships: [
      { property: 'district', relatedType: 'District', kind: 'reference', storage: 'foreignKey', canLink: true, canUnlink: false, nodes: world },
      { property: 'locations', relatedType: 'Location', kind: 'collection', storage: 'many', canLink: true, canUnlink: true, nodes: world },
    ],
  },
  { entityName: 'District', displayName: 'District', fields: [], readNodes: world },
  { entityName: 'Location', displayName: 'Location', fields: [], readNodes: world, deletable: true, actionNodes: { delete: [...world, 'knk.admin.delete'] } },
];

const allButtons = JSON.stringify({
  showViewButton: true, showEditButton: true, showAddButton: true, showSelectButton: true, showRemoveButton: true,
  showUnlinkButton: true, showDeleteButton: true, showCreateButton: true,
});

export const structureDisplay: DisplayConfigurationDto = {
  id: '31',
  name: 'Structure (e2e)',
  description: 'Everything about a structure.',
  entityTypeName: 'Structure',
  isDefault: true,
  isDraft: false,
  sections: [
    {
      sectionGuid: 'general', sectionName: 'General', isCollection: false, isReusable: false, isLinkedToSource: false,
      fields: [
        { fieldGuid: 'name', label: 'Name', fieldName: 'name', fieldType: 'String', isEditableInDisplay: true, isReusable: false, isLinkedToSource: false },
        { fieldGuid: 'number', label: 'Street number', fieldName: 'streetNumber', isReusable: false, isLinkedToSource: false },
      ],
      subSections: [],
    },
    {
      sectionGuid: 'district', sectionName: 'District', isCollection: false, isReusable: false, isLinkedToSource: false,
      relatedEntityPropertyName: 'District', relatedEntityTypeName: 'District', actionButtonsConfigJson: allButtons,
      fields: [{ fieldGuid: 'district-name', label: 'District name', fieldName: 'name', isReusable: false, isLinkedToSource: false }],
      subSections: [],
    },
    {
      sectionGuid: 'locations', sectionName: 'Locations', isCollection: true, isReusable: false, isLinkedToSource: false,
      relatedEntityPropertyName: 'Locations', relatedEntityTypeName: 'Location', actionButtonsConfigJson: allButtons,
      fields: [{ fieldGuid: 'location-name', label: 'Name', fieldName: 'name', isReusable: false, isLinkedToSource: false }],
      subSections: [],
    },
  ],
};

export const bakery: StructureDto & { district: { id: number; name: string }; locations: { id: number; name: string }[] } = {
  id: 10, name: 'Bakery', description: 'Fresh bread every morning.', allowEntry: true, worldName: 'world',
  streetId: 2, districtId: 5, streetNumber: 3,
  district: { id: 5, name: 'Old Market' },
  locations: [{ id: 41, name: 'Bakery door' }, { id: 42, name: 'Bakery oven' }],
};

/** The public panel of the Bakery (everyone). */
export function mockBakeryPanel(api: MockApi): void {
  api.json<MapStructurePanelDto>('GET', 'Map/structures/10', bakeryPanel);
}

/** What the staff details read: the type metadata, the default Structure display configuration and the record. */
export function mockBakeryDetails(api: MockApi): void {
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', structureMetadata);
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/Structure', structureDisplay);
  api.json<typeof bakery>('GET', 'Structures/10', bakery);
}
