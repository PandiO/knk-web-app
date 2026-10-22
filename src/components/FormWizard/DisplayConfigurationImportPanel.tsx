import React from 'react';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import {
    DisplayConfigurationImportResult,
    DisplayConfigurationSeed,
    PortableDisplayConfiguration
} from '../../types/dtos/displayConfig/DisplayPortabilityModels';
import {
    describeDisplayImportCounts,
    describeDisplayImportResult,
    describeDisplaySeedCounts,
    readPortableDisplayFile
} from '../../utils/displayConfigPortability';
import { ConfigurationImportAdapter, ConfigurationImportPanel, ConfigurationImportPanelProps } from './ConfigurationImportPanel';

/**
 * Import a display configuration file (knk-displayconfig/1), or one of the API's bundled display seeds
 * (Data/DisplayConfigurationSeeds/). Imports are published unless "Import as a draft" is ticked: the display page
 * only shows the entity's published default. See ConfigurationImportPanel for the dry-run-first flow.
 */
const displayImportAdapter: ConfigurationImportAdapter<PortableDisplayConfiguration, DisplayConfigurationImportResult, DisplayConfigurationSeed> = {
    title: 'Import display configurations',
    fileInputLabel: 'Display configuration file',
    fileHint: 'A JSON file made with Export on this page (format knk-displayconfig/1).',
    seedsHint: 'Default display pages shipped with the API. An entity that already has a default display configuration keeps it unless "Make the imported configuration the default" is ticked.',
    offersDraft: true,
    readFile: readPortableDisplayFile,
    importFile: (file, options) => displayConfigClient.importConfiguration(file, options),
    getSeeds: () => displayConfigClient.getSeeds(),
    importSeed: (name, options) => displayConfigClient.importSeed(name, options),
    describeResult: describeDisplayImportResult,
    describeCounts: describeDisplayImportCounts,
    describeSeedCounts: describeDisplaySeedCounts,
    importedId: seed => seed.importedDisplayConfigurationId
};

export const DisplayConfigurationImportPanel: React.FC<ConfigurationImportPanelProps<DisplayConfigurationImportResult>> = props => (
    <ConfigurationImportPanel adapter={displayImportAdapter} {...props} />
);
