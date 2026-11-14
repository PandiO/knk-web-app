import type { DisplayConfigurationDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { FormSubmissionProgressSummaryDto } from '../../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto, EntityTypeConfigurationDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { MockApi } from '../support/mockApi';

/**
 * The lookups every content page (dashboard, entity setup, form wizard) makes on load, answered
 * empty: no entity metadata, no type settings, no display configurations, no saved drafts. The
 * pages fall back to their built-in column and field settings.
 */
export function mockContentDefaults(api: MockApi): void {
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', []);
  api.json<EntityTypeConfigurationDto[]>('GET', 'EntityTypeConfiguration', []);
  api.json<DisplayConfigurationDto[]>('GET', /^DisplayConfigurations\/?$/, []);
  api.json<string[]>('GET', 'FormConfigurations/entity-names', []);
  api.json<FormSubmissionProgressSummaryDto[]>('GET', 'FormSubmissionProgress/entity', []);
}
