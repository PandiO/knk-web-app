import { isDerived } from '../detailPage';
import { RelationshipMetadataDto } from '../../../types/dtos/metadata/MetadataModels';

const relationship = (storage: RelationshipMetadataDto['storage']): RelationshipMetadataDto => ({
  property: 'streets', relatedType: 'Street', kind: 'collection', storage, canLink: false, canUnlink: false, nodes: [],
});

describe('isDerived (#409)', () => {
  it('is true only for a derived relationship', () => {
    expect(isDerived(relationship('derived'))).toBe(true);
    (['foreignKey', 'children', 'many', 'linkRow', 'other'] as const).forEach(storage =>
      expect(isDerived(relationship(storage))).toBe(false));
  });

  it('is false without a relationship', () => {
    expect(isDerived(undefined)).toBe(false);
    expect(isDerived(null)).toBe(false);
  });
});
