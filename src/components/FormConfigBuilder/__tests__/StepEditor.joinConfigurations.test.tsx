import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepEditor } from '../StepEditor';
import { FormStepDto } from '../../../types/dtos/forms/FormModels';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';

jest.mock('../../../apiClients/formConfigClient', () => ({
  formConfigClient: { getByEntityAll: jest.fn(), addReusableFieldToStep: jest.fn() },
}));
jest.mock('../../../apiClients/metadataClient', () => ({
  metadataClient: { getAllEntityMetadata: jest.fn(), getEntityMetadata: jest.fn() },
}));

const getByEntityAll = formConfigClient.getByEntityAll as jest.Mock;

const baseStep = {
  id: '1',
  stepName: 'Districts',
  order: 0,
  isReusable: false,
  isLinkedToSource: false,
  hasCompatibilityIssues: false,
  isManyToManyRelationship: true,
  joinEntityType: 'TownDistrict',
  subConfigurationId: '99',
  childFormSteps: [],
  fields: [],
  conditions: [],
} as unknown as FormStepDto;

// PandiO/knk-workspace#218: the join configurations load reads the latest step through a ref, so
// clearing a sub-configuration that no longer exists keeps edits made while the fetch ran.
describe('StepEditor join configurations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([]);
    (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({ entityName: 'TownDistrict', fields: [] });
  });

  it('clears a missing sub-configuration on the latest step, not the one from when the fetch started', async () => {
    let resolveConfigs: (configs: unknown[]) => void = () => undefined;
    getByEntityAll.mockImplementation(() => new Promise(resolve => { resolveConfigs = resolve; }));
    const onUpdate = jest.fn();
    const props = { reusableFields: [], reusableSteps: [], onUpdate };

    const { rerender } = render(<StepEditor step={baseStep} {...props} />);
    await waitFor(() => expect(getByEntityAll).toHaveBeenCalledWith('TownDistrict'));

    // The step is renamed while the fetch runs; that alone doesn't start a new fetch.
    const renamed = { ...baseStep, stepName: 'Town districts' } as FormStepDto;
    rerender(<StepEditor step={renamed} {...props} />);
    expect(getByEntityAll).toHaveBeenCalledTimes(1);

    await act(async () => { resolveConfigs([{ id: '7', configurationName: 'Other' }]); });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ stepName: 'Town districts', subConfigurationId: undefined }));
  });
});
