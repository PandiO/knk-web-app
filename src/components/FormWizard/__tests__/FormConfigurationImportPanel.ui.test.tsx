import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormConfigurationImportPanel } from '../FormConfigurationImportPanel';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { FormConfigurationImportResult, FormConfigurationSeed } from '../../../types/dtos/forms/FormPortabilityModels';

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getSeeds: jest.fn(),
        importConfiguration: jest.fn(),
        importSeed: jest.fn()
    }
}));

const client = formConfigClient as jest.Mocked<typeof formConfigClient>;

const result = (overrides: Partial<FormConfigurationImportResult>): FormConfigurationImportResult => ({
    status: 'DryRunPassed',
    dryRun: true,
    message: '',
    isDefault: false,
    stepCount: 3,
    fieldCount: 7,
    validationRuleCount: 1,
    errors: [],
    warnings: [],
    ...overrides
});

const seed = (name: string, entityTypeName: string, overrides: Partial<FormConfigurationSeed> = {}): FormConfigurationSeed => ({
    name,
    entityTypeName,
    configurationName: `${entityTypeName} - Default`,
    configurationGuid: `guid-${name}`,
    stepCount: 2,
    fieldCount: 5,
    imported: false,
    ...overrides
});

const portableFile = { format: 'knk-formconfig/1', configurationGuid: 'g', entityTypeName: 'GateStructure', name: 'Gate Structure', steps: [] };

const chooseFile = (content: string, name = 'GateStructure.json') => {
    const input = screen.getByLabelText('Form configuration file');
    fireEvent.change(input, { target: { files: [new File([content], name, { type: 'application/json' })] } });
};

const renderPanel = (onImported = jest.fn()) => {
    render(<FormConfigurationImportPanel open entityTypeName="GateStructure" onClose={jest.fn()} onImported={onImported} />);
    return onImported;
};

describe('FormConfigurationImportPanel (KNG-138)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        client.getSeeds.mockResolvedValue([]);
    });

    it('dry-runs a chosen file and imports it only after the dry run passed', async () => {
        client.importConfiguration
            .mockResolvedValueOnce(result({ isDefault: true }))
            .mockResolvedValueOnce(result({ status: 'Imported', dryRun: false, formConfigurationId: '41', isDefault: true }));
        const onImported = renderPanel();

        chooseFile(JSON.stringify(portableFile));

        const banner = await screen.findByRole('status', { name: 'File import result' });
        expect(banner).toHaveTextContent('Dry run passed. Importing will make it the default (there is none yet).');
        expect(banner).toHaveTextContent('3 steps, 7 fields, 1 validation rule');
        expect(client.importConfiguration).toHaveBeenCalledWith(portableFile, { dryRun: true, makeDefault: false });

        fireEvent.click(screen.getByRole('button', { name: 'Import "Gate Structure"' }));

        await waitFor(() => expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ status: 'Imported', formConfigurationId: '41' })));
        expect(client.importConfiguration).toHaveBeenLastCalledWith(portableFile, { dryRun: false, makeDefault: false });
        expect(screen.getByRole('status', { name: 'File import result' })).toHaveTextContent('Imported as configuration 41 (default).');
        expect(screen.queryByRole('button', { name: /^Import "/ })).not.toBeInTheDocument();
    });

    it('shows the problems of a failed dry run and offers no import', async () => {
        client.importConfiguration.mockResolvedValue(result({
            status: 'Invalid',
            errors: ["Metadata check: 'NoSuchProperty' (Field not found)", "Step 'Doors' refers to configuration 'GateDoor' (g2), which is not in this database. Import it first."],
            warnings: ['world task type \'X\' is not one of the known types']
        }));
        renderPanel();

        chooseFile(JSON.stringify(portableFile));

        const problems = await screen.findByRole('list', { name: 'Import problems' });
        expect(within(problems).getAllByRole('listitem')).toHaveLength(2);
        expect(problems).toHaveTextContent('NoSuchProperty');
        expect(screen.getByRole('list', { name: 'Import warnings' })).toHaveTextContent('world task type');
        expect(screen.getByRole('status', { name: 'File import result' })).toHaveTextContent('2 problems found. Nothing was imported.');
        expect(screen.queryByRole('button', { name: /^Import "/ })).not.toBeInTheDocument();
    });

    it('reports an already imported file as such', async () => {
        client.importConfiguration.mockResolvedValue(result({ status: 'AlreadyImported', formConfigurationId: '9' }));
        renderPanel();

        chooseFile(JSON.stringify(portableFile));

        expect(await screen.findByRole('status', { name: 'File import result' })).toHaveTextContent('Already imported as configuration 9. Nothing was changed.');
        expect(screen.queryByRole('button', { name: /^Import "/ })).not.toBeInTheDocument();
    });

    it('rejects a file that is not an export without calling the API', async () => {
        renderPanel();

        chooseFile('{"format": "something-else"}', 'other.json');

        expect(await screen.findByRole('alert')).toHaveTextContent('not a form configuration export');
        expect(client.importConfiguration).not.toHaveBeenCalled();
    });

    it('checks the file again when "make default" changes, and imports with that choice', async () => {
        client.importConfiguration
            .mockResolvedValueOnce(result({}))
            .mockResolvedValueOnce(result({ isDefault: true, replacedDefaultId: '9', replacedDefaultName: 'Gate Structure Configuration' }))
            .mockResolvedValueOnce(result({ status: 'Imported', formConfigurationId: '42', isDefault: true, replacedDefaultId: '9' }));
        renderPanel();
        chooseFile(JSON.stringify(portableFile));
        await screen.findByText('Dry run passed. Importing will add it as a non-default configuration.');

        fireEvent.click(screen.getByRole('checkbox'));

        expect(await screen.findByText('Dry run passed. Importing will make it the default, replacing "Gate Structure Configuration".')).toBeInTheDocument();
        expect(client.importConfiguration).toHaveBeenLastCalledWith(portableFile, { dryRun: true, makeDefault: true });
        fireEvent.click(screen.getByRole('button', { name: 'Import "Gate Structure"' }));
        await waitFor(() => expect(client.importConfiguration).toHaveBeenLastCalledWith(portableFile, { dryRun: false, makeDefault: true }));
    });

    it('lists the seeds of the selected entity, with all seeds on request', async () => {
        client.getSeeds.mockResolvedValue([
            seed('GateDoor', 'GateDoor'),
            seed('GateStructure', 'GateStructure', { imported: true, importedFormConfigurationId: '50' }),
            seed('SiegeScenario', 'SiegeScenario')
        ]);
        renderPanel();

        const imported = await screen.findByRole('listitem', { name: 'Seed GateStructure' });
        expect(imported).toHaveTextContent('Imported (#50)');
        expect(within(imported).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('listitem', { name: 'Seed GateDoor' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Show all (3)' }));

        expect(screen.getByRole('listitem', { name: 'Seed GateDoor' })).toBeInTheDocument();
        expect(screen.getByRole('listitem', { name: 'Seed SiegeScenario' })).toBeInTheDocument();
    });

    it('checks a seed, then imports it and refreshes the list', async () => {
        client.getSeeds
            .mockResolvedValueOnce([seed('GateStructure', 'GateStructure')])
            .mockResolvedValueOnce([seed('GateStructure', 'GateStructure', { imported: true, importedFormConfigurationId: '51' })]);
        client.importSeed
            .mockResolvedValueOnce(result({ isDefault: true }))
            .mockResolvedValueOnce(result({ status: 'Imported', formConfigurationId: '51', isDefault: true }));
        const onImported = renderPanel();

        const row = await screen.findByRole('listitem', { name: 'Seed GateStructure' });
        expect(within(row).queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
        fireEvent.click(within(row).getByRole('button', { name: 'Check' }));

        expect(await within(row).findByRole('status', { name: 'Result for GateStructure' })).toHaveTextContent('Dry run passed');
        expect(client.importSeed).toHaveBeenCalledWith('GateStructure', { dryRun: true, makeDefault: false });

        fireEvent.click(within(row).getByRole('button', { name: 'Import' }));

        await waitFor(() => expect(onImported).toHaveBeenCalled());
        expect(client.importSeed).toHaveBeenLastCalledWith('GateStructure', { dryRun: false, makeDefault: false });
        expect(await screen.findByText('Imported (#51)')).toBeInTheDocument();
    });

    it('shows an unreadable seed with its error and no buttons', async () => {
        client.getSeeds.mockResolvedValue([seed('GateStructure', 'GateStructure', { error: 'Not a readable knk-formconfig/1 file' })]);
        renderPanel();

        const row = await screen.findByRole('listitem', { name: 'Seed GateStructure' });
        expect(row).toHaveTextContent('Unreadable');
        expect(row).toHaveTextContent('Not a readable knk-formconfig/1 file');
        expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    });

    it('says when there are no seeds for the entity', async () => {
        renderPanel();
        expect(await screen.findByText('No bundled seeds for GateStructure.')).toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
        const { container } = render(<FormConfigurationImportPanel open={false} onClose={jest.fn()} onImported={jest.fn()} />);
        expect(container).toBeEmptyDOMElement();
        expect(client.getSeeds).not.toHaveBeenCalled();
    });
});
