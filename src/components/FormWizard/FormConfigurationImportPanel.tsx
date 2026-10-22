import React from 'react';
import { formConfigClient } from '../../apiClients/formConfigClient';
import {
    FormConfigurationImportResult,
    FormConfigurationSeed,
    PortableFormConfiguration
} from '../../types/dtos/forms/FormPortabilityModels';
import { describeImportCounts, describeImportResult, readPortableFile } from '../../utils/forms/formConfigPortability';
import { ConfigurationImportAdapter, ConfigurationImportPanel, ConfigurationImportPanelProps } from './ConfigurationImportPanel';

/**
 * KNG-138: import a form configuration file (knk-formconfig/1), or one of the API's bundled seeds
 * (Data/FormConfigurationSeeds/). See ConfigurationImportPanel for the dry-run-first flow.
 */
const formImportAdapter: ConfigurationImportAdapter<PortableFormConfiguration, FormConfigurationImportResult, FormConfigurationSeed> = {
    title: 'Import form configurations',
    fileInputLabel: 'Form configuration file',
    fileHint: 'A JSON file made with Export on this page (format knk-formconfig/1).',
    seedsHint: 'Default forms shipped with the API. Join entries and child forms must be imported before the forms that use them.',
    readFile: readPortableFile,
    importFile: (file, { dryRun, makeDefault }) => formConfigClient.importConfiguration(file, { dryRun, makeDefault }),
    getSeeds: () => formConfigClient.getSeeds(),
    importSeed: (name, { dryRun, makeDefault }) => formConfigClient.importSeed(name, { dryRun, makeDefault }),
    describeResult: describeImportResult,
    describeCounts: describeImportCounts,
    describeSeedCounts: seed => `${seed.stepCount} steps, ${seed.fieldCount} fields`,
    importedId: seed => seed.importedFormConfigurationId
};

export const FormConfigurationImportPanel: React.FC<ConfigurationImportPanelProps<FormConfigurationImportResult>> = props => (
    <ConfigurationImportPanel adapter={formImportAdapter} {...props} />
);
