import React from 'react';
import { render, screen } from '@testing-library/react';
import { CollectionSection } from '../CollectionSection';
import { DisplayFieldDto, DisplaySectionDto } from '../../../types/dtos/displayConfig/DisplayModels';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn()
}), { virtual: true });

const field = (overrides: Partial<DisplayFieldDto>): DisplayFieldDto => ({
    label: 'Field',
    isReusable: false,
    isLinkedToSource: false,
    ...overrides
});

const section = (overrides: Partial<DisplaySectionDto>): DisplaySectionDto => ({
    sectionName: 'Section',
    isReusable: false,
    isLinkedToSource: false,
    isCollection: false,
    actionButtonsConfigJson: '{}',
    fields: [],
    subSections: [],
    ...overrides
});

// ItemBlueprint.DefaultEnchantments items, as the ItemBlueprint read DTO returns them
const defaultEnchantments = [
    {
        itemBlueprintId: 1,
        enchantmentDefinitionId: 7,
        level: 2,
        enchantmentDefinition: { id: 7, key: 'sharpness', displayName: 'Sharpness', maxLevel: 5, isCustom: false }
    },
    {
        itemBlueprintId: 1,
        enchantmentDefinitionId: 8,
        level: 1,
        enchantmentDefinition: { id: 8, key: 'lifesteal', displayName: 'Lifesteal', maxLevel: 3, isCustom: true }
    }
];

describe('CollectionSection', () => {
    it('renders the collection section\'s own fields against each item, including fields of a related entity', () => {
        const collection = section({
            isCollection: true,
            relatedEntityPropertyName: 'DefaultEnchantments',
            relatedEntityTypeName: 'ItemBlueprintDefaultEnchantment',
            fields: [
                field({ fieldGuid: 'f1', label: 'Enchantment', relatedEntityPropertyName: 'EnchantmentDefinition', relatedEntityTypeName: 'EnchantmentDefinition', fieldName: 'DisplayName', fieldType: 'String' }),
                field({ fieldGuid: 'f2', label: 'IsCustom', relatedEntityPropertyName: 'EnchantmentDefinition', relatedEntityTypeName: 'EnchantmentDefinition', fieldName: 'IsCustom', fieldType: 'Boolean' }),
                field({ fieldGuid: 'f3', label: 'MaxLevel', relatedEntityPropertyName: 'EnchantmentDefinition', relatedEntityTypeName: 'EnchantmentDefinition', fieldName: 'MaxLevel', fieldType: 'Integer' }),
                field({ fieldGuid: 'f4', label: 'Level', fieldName: 'Level', fieldType: 'Integer' })
            ],
            fieldOrderJson: JSON.stringify(['f1', 'f2', 'f3', 'f4']),
            // A leftover item-template subsection must not take precedence over the section's own fields
            subSections: [
                section({
                    sectionName: 'Item Template',
                    fields: [field({ fieldGuid: 's1', label: 'Stale', relatedEntityPropertyName: 'DefaultEnchantments', fieldName: 'EnchantmentDefinition', fieldType: 'Object' })]
                })
            ]
        });

        render(<CollectionSection section={collection} collectionData={defaultEnchantments} onActionClick={jest.fn()} />);

        expect(screen.getByText('Sharpness')).toBeInTheDocument();
        expect(screen.getByText('Lifesteal')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Yes')).toBeInTheDocument();
        expect(screen.getByText('No')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    });

    it('falls back to the first subsection as item template when the collection section has no fields', () => {
        const collection = section({
            isCollection: true,
            relatedEntityPropertyName: 'DefaultEnchantments',
            subSections: [
                section({
                    sectionName: 'Item Template',
                    fields: [field({ fieldGuid: 's1', label: 'Enchantment', relatedEntityPropertyName: 'EnchantmentDefinition', fieldName: 'DisplayName' })]
                })
            ]
        });

        render(<CollectionSection section={collection} collectionData={defaultEnchantments} onActionClick={jest.fn()} />);

        expect(screen.getByText('Sharpness')).toBeInTheDocument();
        expect(screen.getByText('Lifesteal')).toBeInTheDocument();
    });

    it('reports a missing template when there are neither fields nor subsections', () => {
        const collection = section({ isCollection: true, relatedEntityPropertyName: 'DefaultEnchantments' });

        render(<CollectionSection section={collection} collectionData={defaultEnchantments} onActionClick={jest.fn()} />);

        expect(screen.getByText('No template configured')).toBeInTheDocument();
    });
});
