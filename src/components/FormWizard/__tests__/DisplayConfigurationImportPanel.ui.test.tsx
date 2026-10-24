import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayConfigurationImportPanel } from '../DisplayConfigurationImportPanel';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { DisplayConfigurationImportResult, DisplayConfigurationSeed } from '../../../types/dtos/displayConfig/DisplayPortabilityModels';

jest.mock('../../../apiClients/displayConfigClient', () => ({
    displayConfigClient: {
        getSeeds: jest.fn(),
        importConfiguration: jest.fn(),
        importSeed: jest.fn()
    }
}));

const client = displayConfigClient as jest.Mocked<typeof displayConfigClient>;

const result = (overrides: Partial<DisplayConfigurationImportResult>): DisplayConfigurationImportResult => ({
    status: 'DryRunPassed',
    dryRun: true,
    message: '',
    isDefault: false,
    isDraft: false,
    sectionCount: 6,
    fieldCount: 24,
    errors: [],
    warnings: [],
    ...overrides
});

const seed = (name: string, entityTypeName: string, overrides: Partial<DisplayConfigurationSeed> = {}): DisplayConfigurationSeed => ({
    name,
    entityTypeName,
    configurationName: `${entityTypeName} - Default (seed v1)`,
    configurationGuid: `guid-${name}`,
    sectionCount: 6,
    fieldCount: 24,
    imported: false,
    ...overrides
});

const portableFile = { format: 'knk-displayconfig/1', configurationGuid: 'g', entityTypeName: 'User', name: 'User - Default (seed v1)', sections: [] };

const chooseFile = (content: string, name = 'User.display.json') => {
    const input = screen.getByLabelText('Display configuration file');
    fireEvent.change(input, { target: { files: [new File([content], name, { type: 'application/json' })] } });
};

const showPanel = (onImported = jest.fn()) => {
    render(<DisplayConfigurationImportPanel open entityTypeName="User" onClose={jest.fn()} onImported={onImported} />);
    return onImported;
};

describe('DisplayConfigurationImportPanel (knk-displayconfig/1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        client.getSeeds.mockResolvedValue([]);
    });

    it('dry-runs a chosen file and imports it published after the dry run passed', async () => {
        client.importConfiguration
            .mockResolvedValueOnce(result({ isDefault: true }))
            .mockResolvedValueOnce(result({ status: 'Imported', dryRun: false, displayConfigurationId: '41', isDefault: true }));
        const onImported = showPanel();

        expect(screen.getByRole('dialog', { name: 'Import display configurations' })).toBeInTheDocument();
        chooseFile(JSON.stringify(portableFile));

        const banner = await screen.findByRole('status', { name: 'File import result' });
        expect(banner).toHaveTextContent('Dry run passed. Importing will make it the default (there is none yet) and publish it.');
        expect(banner).toHaveTextContent('6 sections, 24 fields');
        expect(client.importConfiguration).toHaveBeenCalledWith(portableFile, { dryRun: true, makeDefault: false, asDraft: false });

        fireEvent.click(screen.getByRole('button', { name: 'Import "User - Default (seed v1)"' }));

        await waitFor(() => expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ status: 'Imported', displayConfigurationId: '41' })));
        expect(client.importConfiguration).toHaveBeenLastCalledWith(portableFile, { dryRun: false, makeDefault: false, asDraft: false });
        expect(screen.getByRole('status', { name: 'File import result' })).toHaveTextContent('Imported as display configuration 41 (published, default).');
    });

    it('checks the file again with "import as a draft", and imports with that choice', async () => {
        client.importConfiguration
            .mockResolvedValueOnce(result({}))
            .mockResolvedValueOnce(result({ isDraft: true }))
            .mockResolvedValueOnce(result({ status: 'Imported', displayConfigurationId: '42', isDraft: true }));
        showPanel();
        chooseFile(JSON.stringify(portableFile));
        await screen.findByText('Dry run passed. Importing will add it as a non-default configuration and publish it.');

        fireEvent.click(screen.getByRole('checkbox', { name: /Import as a draft/ }));

        expect(await screen.findByText('Dry run passed. Importing will add it as a non-default configuration and keep it a draft.')).toBeInTheDocument();
        expect(client.importConfiguration).toHaveBeenLastCalledWith(portableFile, { dryRun: true, makeDefault: false, asDraft: true });
        fireEvent.click(screen.getByRole('button', { name: 'Import "User - Default (seed v1)"' }));
        await waitFor(() => expect(client.importConfiguration).toHaveBeenLastCalledWith(portableFile, { dryRun: false, makeDefault: false, asDraft: true }));
    });

    it('shows the metadata warnings of a dry run', async () => {
        client.importConfiguration.mockResolvedValue(result({
            warnings: ["Section 'Permission groups': User has no property 'PermissionGroups'. (metadataCheck \"warn\")"]
        }));
        showPanel();

        chooseFile(JSON.stringify(portableFile));

        expect(await screen.findByRole('list', { name: 'Import warnings' })).toHaveTextContent('PermissionGroups');
        expect(screen.getByRole('button', { name: /^Import "/ })).toBeInTheDocument();
    });

    it('rejects a form configuration file without calling the API', async () => {
        showPanel();

        chooseFile('{"format": "knk-formconfig/1"}', 'GateStructure.json');

        expect(await screen.findByRole('alert')).toHaveTextContent('It is a form configuration');
        expect(client.importConfiguration).not.toHaveBeenCalled();
    });

    it('checks a seed with "make default", then imports it and refreshes the list', async () => {
        client.getSeeds
            .mockResolvedValueOnce([seed('User.display', 'User'), seed('GateStructure.display', 'GateStructure')])
            .mockResolvedValueOnce([seed('User.display', 'User', { imported: true, importedDisplayConfigurationId: '51' })]);
        client.importSeed
            .mockResolvedValueOnce(result({ isDefault: true, replacedDefaultId: '4', replacedDefaultName: 'User display' }))
            .mockResolvedValueOnce(result({ status: 'Imported', displayConfigurationId: '51', isDefault: true }));
        const onImported = showPanel();

        const row = await screen.findByRole('listitem', { name: 'Seed User.display' });
        expect(row).toHaveTextContent('User · 6 sections, 24 fields · User.display.json');
        expect(screen.queryByRole('listitem', { name: 'Seed GateStructure.display' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: /Make the imported configuration the default/ }));
        fireEvent.click(within(row).getByRole('button', { name: 'Check' }));

        expect(await within(row).findByRole('status', { name: 'Result for User.display' }))
            .toHaveTextContent('Dry run passed. Importing will make it the default, replacing "User display", and publish it.');
        expect(client.importSeed).toHaveBeenCalledWith('User.display', { dryRun: true, makeDefault: true, asDraft: false });

        fireEvent.click(within(row).getByRole('button', { name: 'Import' }));

        await waitFor(() => expect(onImported).toHaveBeenCalled());
        expect(client.importSeed).toHaveBeenLastCalledWith('User.display', { dryRun: false, makeDefault: true, asDraft: false });
        expect(await screen.findByText('Imported (#51)')).toBeInTheDocument();
    });

    it('asks for a new check when a choice changes after a seed check', async () => {
        client.getSeeds.mockResolvedValue([seed('User.display', 'User')]);
        client.importSeed.mockResolvedValue(result({}));
        showPanel();

        const row = await screen.findByRole('listitem', { name: 'Seed User.display' });
        fireEvent.click(within(row).getByRole('button', { name: 'Check' }));
        expect(await within(row).findByRole('button', { name: 'Import' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('checkbox', { name: /Import as a draft/ }));

        expect(within(row).queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    });
});
