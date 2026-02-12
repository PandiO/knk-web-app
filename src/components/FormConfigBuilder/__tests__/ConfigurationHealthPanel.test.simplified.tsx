import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigurationHealthPanel } from '../ConfigurationHealthPanel';
import * as fieldValidationRuleClient from '../../../apiClients/fieldValidationRuleClient';
import { ValidationIssueDto } from '../../../types/dtos/forms/FieldValidationRuleDtos';

jest.mock('../../../apiClients/fieldValidationRuleClient');

describe('ConfigurationHealthPanel (simplified)', () => {
  const mockNoIssues: ValidationIssueDto[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders panel and refresh control', async () => {
    jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockResolvedValue(mockNoIssues);

    render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(screen.getByTestId('health-panel')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });
  });
});
