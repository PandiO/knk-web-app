import type { DisplayConfigurationDto, DisplaySectionDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { EntityMetadataDto, RelationshipMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { TownDto } from '../../src/types/dtos/town/TownDto';

/**
 * The town detail page (/display/Town/4) for e2e/town-detail.spec.ts, typed with the app's DTOs (see
 * e2e/fixtures/auth.ts). PandiO/knk-workspace#409: a town's streets are derived from its districts, so the API lists
 * the relationship as `storage: 'derived'` with the reason the page shows as the hint.
 */

export const townStreetsHint = 'Streets are managed on the district: open a district to add or remove them.';

const world = ['knk.admin.world', 'knk.admin.content'];

export const townStreetsRelationship: RelationshipMetadataDto = {
  property: 'streets',
  relatedType: 'Street',
  kind: 'collection',
  storage: 'derived',
  canLink: false,
  canUnlink: false,
  linkReason: townStreetsHint,
  unlinkReason: townStreetsHint,
  nodes: world,
};

export const townMetadata: EntityMetadataDto[] = [
  {
    entityName: 'Town',
    displayName: 'Town',
    fields: [],
    readNodes: ['knk.admin.world'],
    lookupGettable: true,
    actionNodes: { edit: world, delete: ['knk.admin.world', 'knk.admin.delete'] },
    relationships: [townStreetsRelationship],
  },
  {
    entityName: 'Street',
    displayName: 'Street',
    fields: [],
    readNodes: ['knk.admin.world', 'knk.admin.road'],
    deletable: true,
    actionNodes: { edit: world, delete: ['knk.admin.world', 'knk.admin.delete'] },
  },
];

const streetsSection: DisplaySectionDto = {
  sectionGuid: 'streets',
  sectionName: 'Streets',
  isCollection: true,
  isReusable: false,
  isLinkedToSource: false,
  relatedEntityPropertyName: 'Streets',
  relatedEntityTypeName: 'Street',
  // A configuration made before #409 still asks for every button: the page hides the ones a derived list can't use.
  actionButtonsConfigJson: JSON.stringify({
    showViewButton: true, showEditButton: true, showAddButton: true, showRemoveButton: true,
    showDeleteButton: true, showCreateButton: true,
  }),
  fields: [{ fieldGuid: 'street-name', label: 'Name', fieldName: 'name', isReusable: false, isLinkedToSource: false }],
  subSections: [],
};

export const townDisplay: DisplayConfigurationDto = {
  id: '21',
  name: 'Town (e2e)',
  entityTypeName: 'Town',
  isDefault: true,
  isDraft: false,
  sections: [
    {
      sectionGuid: 'general',
      sectionName: 'General',
      isCollection: false,
      isReusable: false,
      isLinkedToSource: false,
      fields: [{ fieldGuid: 'town-name', label: 'Name', fieldName: 'name', isReusable: false, isLinkedToSource: false }],
      subSections: [],
    },
    streetsSection,
  ],
};

/** Cinix: two districts' streets, as the API derives them (distinct, by name). */
export const cinix: TownDto = {
  id: 4,
  name: 'Cinix',
  allowEntry: true,
  requiredTitle: 0,
  worldName: 'world',
  streetIds: [12, 11],
  streets: [
    { id: 12, name: 'Harbour Road' },
    { id: 11, name: 'Main Street' },
  ],
};
