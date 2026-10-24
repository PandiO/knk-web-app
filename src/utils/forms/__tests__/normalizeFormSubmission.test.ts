import { normalizeFormSubmission, UnsavedRelationshipValueError } from '../normalizeFormSubmission';
import { FieldType } from '../../enums';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { EntityMetadataDto, FieldMetadataDto } from '../../../types/dtos/metadata/MetadataModels';

describe('normalizeFormSubmission (many-to-many join entries)', () => {
    const joinEntityMetadata: EntityMetadataDto = {
        entityName: 'ItemBlueprintDefaultEnchantment',
        displayName: 'Item Blueprint Default Enchantment',
        fields: [
            {
                fieldName: 'EnchantmentDefinition',
                fieldType: 'Object',
                isNullable: false,
                isRelatedEntity: true,
                relatedEntityType: 'EnchantmentDefinition',
                hasDefaultValue: false
            },
            {
                fieldName: 'EnchantmentDefinitionId',
                fieldType: 'Integer',
                isNullable: false,
                isRelatedEntity: false,
                relatedEntityType: null,
                hasDefaultValue: false
            } as FieldMetadataDto
        ]
    };

    const formField: FormFieldDto = {
        id: 'field-1',
        formStepId: 'step-1',
        fieldGuid: 'field-guid-1',
        fieldName: 'defaultEnchantments',
        label: 'Default Enchantments',
        fieldType: FieldType.List,
        isRequired: false,
        isReadOnly: false,
        order: 0,
        objectType: 'ItemBlueprintDefaultEnchantment',
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: []
    };

    const step: FormStepDto = {
        id: 'step-1',
        stepName: 'Step 1',
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: true,
        relatedEntityPropertyName: 'defaultEnchantments',
        joinEntityType: 'ItemBlueprintDefaultEnchantment',
        childFormSteps: [],
        fields: [formField],
        conditions: []
    };

    const config: FormConfigurationDto = {
        id: 'config-1',
        entityTypeName: 'ItemBlueprint',
        configurationName: 'Item Blueprint',
        isDefault: true,
        steps: [step]
    };

    it('preserves join objects and maps related entity FK', () => {
        const rawFormValue = {
            defaultEnchantments: [
                {
                    relatedEntityId: 3,
                    level: 2,
                    relatedEntity: { id: 3, name: 'Sharpness' },
                    __childProgressId: 'progress-1'
                }
            ]
        };

        const normalized = normalizeFormSubmission({
            entityTypeName: 'ItemBlueprint',
            formConfiguration: config,
            rawFormValue,
            entityMetadata: [],
            joinEntityMetadataMap: {
                ItemBlueprintDefaultEnchantment: joinEntityMetadata
            }
        });

        expect(Array.isArray(normalized.defaultEnchantments)).toBe(true);
        expect(normalized.defaultEnchantments).toHaveLength(1);
        expect(normalized.defaultEnchantments[0]).toMatchObject({
            EnchantmentDefinitionId: 3,
            level: 2
        });
        expect(normalized.defaultEnchantments[0].relatedEntity).toBeUndefined();
        expect(normalized.defaultEnchantments[0].relatedEntityId).toBeUndefined();
        expect(normalized.defaultEnchantments[0].__childProgressId).toBeUndefined();
    });

    it('throws when join entity metadata is missing', () => {
        const rawFormValue = {
            defaultEnchantments: [{ relatedEntityId: 3, level: 2 }]
        };

        expect(() =>
            normalizeFormSubmission({
                entityTypeName: 'ItemBlueprint',
                formConfiguration: config,
                rawFormValue,
                entityMetadata: []
            })
        ).toThrow('Join entity metadata is missing');
    });

    it('throws when related entity id is missing', () => {
        const rawFormValue = {
            defaultEnchantments: [{ level: 2 }]
        };

        expect(() =>
            normalizeFormSubmission({
                entityTypeName: 'ItemBlueprint',
                formConfiguration: config,
                rawFormValue,
                entityMetadata: [],
                joinEntityMetadataMap: {
                    ItemBlueprintDefaultEnchantment: joinEntityMetadata
                }
            })
        ).toThrow('missing a related entity selection');
    });
});

describe('normalizeFormSubmission (world task locations)', () => {
    const locationField: FormFieldDto = {
        fieldName: 'AnchorPointId',
        label: 'Anchor point',
        fieldType: FieldType.Object,
        objectType: 'Location',
        isRequired: true,
        isReadOnly: false,
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: []
    };

    const config: FormConfigurationDto = {
        entityTypeName: 'GateStructure',
        configurationName: 'Gate Structure',
        isDefault: true,
        steps: [{
            stepName: 'Geometry: Plane Grid',
            order: 0,
            fields: [locationField]
        } as FormStepDto]
    };

    it('maps an ID-less captured Location to the embedded navigation property', () => {
        const capturedLocation = {
            name: 'Location',
            x: 1422.7,
            y: 85,
            z: -521.59,
            yaw: -171.78,
            pitch: 89.85,
            World: 'world_KNK-DEV'
        };

        const normalized = normalizeFormSubmission({
            entityTypeName: 'GateStructure',
            formConfiguration: config,
            rawFormValue: { AnchorPointId: capturedLocation },
            entityMetadata: []
        });

        expect(normalized.AnchorPoint).toEqual(capturedLocation);
        expect(normalized.AnchorPointId).toBeUndefined();
    });

    it('keeps a persisted Location as a foreign key ID', () => {
        const normalized = normalizeFormSubmission({
            entityTypeName: 'GateStructure',
            formConfiguration: config,
            rawFormValue: { AnchorPointId: { id: 42, name: 'Existing location' } },
            entityMetadata: []
        });

        expect(normalized.AnchorPointId).toBe(42);
        expect(normalized.AnchorPoint).toBeUndefined();
    });

    it('submits the full object (with its existing id) when an already-persisted Location was edited', () => {
        // Regression test: editing an existing Location's own fields (e.g. via "Edit instance")
        // used to collapse to just AnchorPointId, silently discarding the edited coordinates.
        const editedLocation = {
            id: 33,
            name: 'Location',
            x: 1421.5,
            y: 91,
            z: -521.5,
            yaw: 0,
            pitch: 0,
            world: 'world_KNK-DEV'
        };

        const normalized = normalizeFormSubmission({
            entityTypeName: 'GateStructure',
            formConfiguration: config,
            rawFormValue: { AnchorPointId: editedLocation },
            entityMetadata: []
        });

        expect(normalized.AnchorPoint).toEqual(editedLocation);
        expect(normalized.AnchorPointId).toBeUndefined();
    });
});

describe('normalizeFormSubmission (world task scan summary fields)', () => {
    const worldTaskSettingsJson = (taskType: string) =>
        JSON.stringify({ worldTask: { enabled: true, taskType } });

    const openedBlockSnapshotsField: FormFieldDto = {
        fieldName: 'openedBlockSnapshots',
        label: 'Opened block snapshots',
        fieldType: FieldType.List,
        objectType: 'GateOpenedBlockSnapshot',
        settingsJson: worldTaskSettingsJson('GateOpenedBlockScan'),
        isRequired: false,
        isReadOnly: false,
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: []
    };

    const blockSnapshotsField: FormFieldDto = {
        fieldName: 'blockSnapshots',
        label: 'Block snapshots',
        fieldType: FieldType.List,
        objectType: 'GateBlockSnapshot',
        settingsJson: worldTaskSettingsJson('GateBlockScan'),
        isRequired: false,
        isReadOnly: false,
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: []
    };

    // A non-headless world-task field (e.g. a location capture) - should NOT be stripped,
    // since its extracted value (a real location object) is legitimate submittable data.
    const anchorPointField: FormFieldDto = {
        fieldName: 'AnchorPointId',
        label: 'Anchor point',
        fieldType: FieldType.Object,
        objectType: 'Location',
        settingsJson: worldTaskSettingsJson('LocationCapture'),
        isRequired: false,
        isReadOnly: false,
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: []
    };

    const config: FormConfigurationDto = {
        entityTypeName: 'GateStructure',
        configurationName: 'Gate Structure',
        isDefault: true,
        steps: [{
            stepName: 'Block scans',
            order: 0,
            fields: [openedBlockSnapshotsField, blockSnapshotsField, anchorPointField]
        } as FormStepDto]
    };

    it('strips the UI-only scan summary object for both blockSnapshots and openedBlockSnapshots', () => {
        const normalized = normalizeFormSubmission({
            entityTypeName: 'GateStructure',
            formConfiguration: config,
            rawFormValue: {
                openedBlockSnapshots: { status: 'Success', blockCount: 32, scannedAt: '2026-09-10T21:46:22.380Z' },
                blockSnapshots: { status: 'Success', blockCount: 12, scannedAt: '2026-09-10T21:46:22.380Z' },
                AnchorPointId: { id: 42, name: 'Existing location' }
            }
        });

        expect(normalized.openedBlockSnapshots).toBeUndefined();
        expect(normalized.blockSnapshots).toBeUndefined();
        expect(normalized.AnchorPointId).toBe(42);
    });

    it('does not choke when the scan field was never populated (still a draft default)', () => {
        const normalized = normalizeFormSubmission({
            entityTypeName: 'GateStructure',
            formConfiguration: config,
            rawFormValue: {
                AnchorPointId: { id: 42, name: 'Existing location' }
            }
        });

        expect(normalized.openedBlockSnapshots).toBeUndefined();
        expect(normalized.blockSnapshots).toBeUndefined();
        expect(normalized.AnchorPointId).toBe(42);
    });
});

describe('normalizeFormSubmission (scalar API types)', () => {
    const createField = (fieldName: string, fieldType: FieldType): FormFieldDto => ({
        fieldName,
        label: fieldName,
        fieldType,
        isRequired: false,
        isReadOnly: false,
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: []
    });

    const config: FormConfigurationDto = {
        entityTypeName: 'GateStructure',
        configurationName: 'Gate Structure',
        isDefault: true,
        steps: [{
            stepName: 'Gate settings',
            order: 0,
            fields: [
                createField('IsActive', FieldType.Boolean),
                createField('ScanMaxBlocks', FieldType.Integer),
                createField('ContinuousDamageMultiplier', FieldType.Decimal),
                createField('ClosedRegionData', FieldType.String)
            ]
        } as FormStepDto]
    };

    it('converts persisted scalar strings to JSON primitives before API submission', () => {
        const normalized = normalizeFormSubmission({
            entityTypeName: 'GateStructure',
            formConfiguration: config,
            rawFormValue: {
                IsActive: 'false',
                ScanMaxBlocks: '500',
                ContinuousDamageMultiplier: '1.5',
                ClosedRegionData: null
            }
        });

        expect(normalized).toMatchObject({
            IsActive: false,
            ScanMaxBlocks: 500,
            ContinuousDamageMultiplier: 1.5,
            ClosedRegionData: null
        });
    });
});

describe('normalizeFormSubmission (KNG-133: entities that were never saved)', () => {
    const relationshipField = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
        fieldName: 'Districts',
        label: 'Districts',
        fieldType: FieldType.List,
        objectType: 'District',
        isRequired: false,
        isReadOnly: false,
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: [],
        ...overrides
    });

    const configWith = (...fields: FormFieldDto[]): FormConfigurationDto => ({
        entityTypeName: 'Street',
        configurationName: 'Street',
        isDefault: true,
        steps: [{ stepName: 'Main', order: 0, fields } as FormStepDto]
    });

    const normalize = (fields: FormFieldDto[], rawFormValue: Record<string, unknown>) =>
        normalizeFormSubmission({
            entityTypeName: 'Street',
            formConfiguration: configWith(...fields),
            rawFormValue,
            entityMetadata: []
        });

    it('sends saved List items as ids', () => {
        const normalized = normalize([relationshipField({})], {
            Districts: [{ id: 501, name: 'Old Quarter' }, { id: 7, name: 'Harbour' }]
        });

        expect(normalized.DistrictIds).toEqual([501, 7]);
    });

    it('throws, naming the field, for a List item with no id instead of dropping it', () => {
        expect(() => normalize([relationshipField({})], {
            Districts: [{ id: 7, name: 'Harbour' }, { name: 'Old Quarter' }]
        })).toThrow(UnsavedRelationshipValueError);

        try {
            normalize([relationshipField({})], { Districts: [{ name: 'Old Quarter' }, { name: 'New Town' }] });
            fail('expected a throw');
        } catch (error) {
            const unsaved = error as UnsavedRelationshipValueError;
            expect(unsaved.fieldName).toBe('Districts');
            expect(unsaved.unsavedCount).toBe(2);
            expect(unsaved.message).toContain('"Districts" holds 2 District entries that were never saved');
        }
    });

    it('throws for an id-less List item of any type, a Location included (List relationships are sent as ids only)', () => {
        const guardSpawns = relationshipField({
            fieldName: 'GuardSpawnLocations',
            label: 'Guard spawn locations',
            objectType: 'Location'
        });

        expect(() => normalize([guardSpawns], {
            GuardSpawnLocations: [{ name: 'Spawn 1', x: 1, y: 64, z: 2 }]
        })).toThrow('"Guard spawn locations" holds 1 Location that was never saved');
    });

    it('throws for a filled-in object held by a List field instead of an array', () => {
        expect(() => normalize([relationshipField({})], { Districts: { name: 'Old Quarter' } }))
            .toThrow(UnsavedRelationshipValueError);
    });

    it('still skips the untouched collection default and empty placeholders', () => {
        expect(normalize([relationshipField({})], { Districts: 'new Collection()' }).DistrictIds).toBeUndefined();
        expect(normalize([relationshipField({})], { Districts: [{}, { name: '' }] }).DistrictIds).toEqual([]);
        expect(normalize([relationshipField({})], { Districts: [] }).DistrictIds).toEqual([]);
    });

    it('throws for an id-less entity in a single Object field (not a Location)', () => {
        const streetField = relationshipField({
            fieldName: 'StreetId',
            label: 'Street',
            fieldType: FieldType.Object,
            objectType: 'Street'
        });

        expect(() => normalize([streetField], { StreetId: { name: 'Market Lane', districtIds: [501] } }))
            .toThrow('"Street" holds a Street that was never saved');
        expect(normalize([streetField], { StreetId: { id: 12, name: 'Market Lane' } }).StreetId).toBe(12);
        // No value / an empty placeholder: no error, and no id is sent.
        expect(normalize([streetField], { StreetId: null }).StreetId ?? null).toBeNull();
        expect(normalize([streetField], { StreetId: {} }).StreetId ?? null).toBeNull();
    });

    it('lets an id-less single Location through as an embedded value', () => {
        const locationField = relationshipField({
            fieldName: 'LocationId',
            label: 'Location',
            fieldType: FieldType.Object,
            objectType: 'Location'
        });
        const captured = { name: 'Gate', x: 1, y: 64, z: 2, World: 'world' };

        expect(normalize([locationField], { LocationId: captured }).Location).toEqual(captured);
        // A Location without coordinates keeps the old behaviour (left out, not an error).
        expect(() => normalize([locationField], { LocationId: { name: 'Gate' } })).not.toThrow();
    });
});

describe('normalizeFormSubmission (KNG-195: hybrid catalog pickers)', () => {
    const field = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
        fieldName: 'MinecraftEnchantmentRefId',
        label: 'Vanilla enchantment',
        fieldType: FieldType.HybridMinecraftEnchantmentRefPicker,
        isRequired: false,
        isReadOnly: false,
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: [],
        ...overrides
    });

    const normalize = (f: FormFieldDto, rawFormValue: Record<string, unknown>) =>
        normalizeFormSubmission({
            entityTypeName: 'EnchantmentDefinition',
            formConfiguration: {
                entityTypeName: 'EnchantmentDefinition',
                configurationName: 'EnchantmentDefinition',
                isDefault: true,
                steps: [{ stepName: 'Main', order: 0, fields: [f] } as FormStepDto]
            },
            rawFormValue,
            entityMetadata: []
        });

    const saved = { id: 12, namespaceKey: 'minecraft:sharpness', displayName: 'Sharpness' };
    // A value without an id (older stored form data): sent by namespaceKey, which the API resolves.
    const catalogOnly = { id: 0, namespaceKey: 'minecraft:smite', displayName: 'Smite' };

    it('turns a hybrid enchantment pick into an id instead of sending the raw object', () => {
        const normalized = normalize(field({}), { MinecraftEnchantmentRefId: saved });

        expect(normalized.MinecraftEnchantmentRefId).toBe(12);
        expect(normalized.MinecraftEnchantmentRefNamespaceKey).toBe('minecraft:sharpness');
    });

    it('sends an unsaved catalog enchantment by namespaceKey, not as id 0', () => {
        const normalized = normalize(field({}), { MinecraftEnchantmentRefId: catalogOnly });

        expect(normalized).not.toHaveProperty('MinecraftEnchantmentRefId');
        expect(normalized.MinecraftEnchantmentRefNamespaceKey).toBe('minecraft:smite');
    });

    it('does the same for an Object picker on MinecraftEnchantmentRef', () => {
        const objectField = field({ fieldType: FieldType.Object, objectType: 'MinecraftEnchantmentRef' });

        const unsaved = normalize(objectField, { MinecraftEnchantmentRefId: catalogOnly });
        expect(unsaved).not.toHaveProperty('MinecraftEnchantmentRefId');
        expect(unsaved.MinecraftEnchantmentRefNamespaceKey).toBe('minecraft:smite');

        expect(normalize(objectField, { MinecraftEnchantmentRefId: saved }).MinecraftEnchantmentRefId).toBe(12);
        expect(normalize(objectField, { MinecraftEnchantmentRefId: 12 }).MinecraftEnchantmentRefId).toBe(12);
    });

    it('sends an unsaved catalog material by namespaceKey under the field-named key', () => {
        const materialField = field({
            fieldName: 'IconMaterialRefId',
            label: 'Material',
            fieldType: FieldType.HybridMinecraftMaterialRefPicker
        });

        const normalized = normalize(materialField, {
            IconMaterialRefId: { id: 0, namespaceKey: 'minecraft:iron_sword', isPersisted: false }
        });

        expect(normalized).not.toHaveProperty('IconMaterialRefId');
        expect(normalized.IconMaterialRefNamespaceKey).toBe('minecraft:iron_sword');
        expect(normalize(materialField, { IconMaterialRefId: { id: 5, namespaceKey: 'minecraft:stone' } }).IconMaterialRefId).toBe(5);
    });
});
