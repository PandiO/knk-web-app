import { hydrateJoinRowsForEdit, joinFieldSeedValues } from '../manyToManyEditLoad';
import { EntityMetadataDto } from '../../../types/dtos/metadata/MetadataModels';

const meta = (fieldName: string, relatedEntityType?: string) => ({
    fieldName,
    fieldType: relatedEntityType ? 'Integer' : 'String',
    isNullable: false,
    isRelatedEntity: !!relatedEntityType,
    relatedEntityType,
    hasDefaultValue: false
});

const GATE_JOIN: EntityMetadataDto = {
    entityName: 'SiegeScenarioGate',
    displayName: 'SiegeScenarioGate',
    fields: [
        meta('SiegeScenarioId', 'SiegeScenario'),
        meta('SiegeScenario', 'SiegeScenario'),
        meta('GateStructureId', 'GateStructure'),
        meta('GateStructure', 'GateStructure'),
        meta('InitialOwnerTeamId', 'SiegeTeam'),
        meta('InitialOwnerTeam', 'SiegeTeam'),
        meta('InitialState'),
        meta('Damageable')
    ]
};

describe('manyToManyEditLoad', () => {
    const savedRow = {
        siegeScenarioId: 1, gateStructureId: 13, gateStructureName: 'South Gate',
        initialOwnerTeamId: 2, initialState: 'OPEN', damageable: false
    };

    it('re-keys a saved row to metadata names and adds the related entity for the card', () => {
        const [row] = hydrateJoinRowsForEdit([savedRow], GATE_JOIN, 'SiegeScenario');

        expect(row).toEqual({
            SiegeScenarioId: 1,
            GateStructureId: 13,
            gateStructureName: 'South Gate',
            InitialOwnerTeamId: 2,
            InitialState: 'OPEN',
            Damageable: false,
            relatedEntityId: 13,
            relatedEntity: { id: 13, name: 'South Gate' }
        });
    });

    it('prefers an embedded navigation object and falls back to a type + id label', () => {
        const [withNav] = hydrateJoinRowsForEdit(
            [{ gateStructureId: 13, gateStructure: { id: 13, name: 'Nav name' } }], GATE_JOIN, 'SiegeScenario');
        expect(withNav.relatedEntity).toEqual({ id: 13, name: 'Nav name' });

        const [bare] = hydrateJoinRowsForEdit([{ gateStructureId: 14 }], GATE_JOIN, 'SiegeScenario');
        expect(bare.relatedEntity).toEqual({ id: 14, name: 'GateStructure #14' });
    });

    it('seeds only the join entity\'s own values when editing a saved row', () => {
        const [row] = hydrateJoinRowsForEdit([savedRow], GATE_JOIN, 'SiegeScenario');

        expect(joinFieldSeedValues(row, GATE_JOIN, 'SiegeScenario')).toEqual({
            InitialOwnerTeamId: 2,
            InitialState: 'OPEN',
            Damageable: false
        });
        expect(joinFieldSeedValues(undefined, GATE_JOIN, 'SiegeScenario')).toEqual({});
    });
});
