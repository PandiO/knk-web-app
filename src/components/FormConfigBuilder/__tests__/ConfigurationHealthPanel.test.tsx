import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ConfigurationHealthPanel } from '../ConfigurationHealthPanel';
import * as fieldValidationRuleClient from '../../../apiClients/fieldValidationRuleClient';
import { ValidationIssueDto } from '../../../types/dtos/forms/FieldValidationRuleDtos';

jest.mock('../../../apiClients/fieldValidationRuleClient');

describe('ConfigurationHealthPanel', () => {
  const mockNoIssues: ValidationIssueDto[] = [];

  const mockIssues: ValidationIssueDto[] = [
    {
      severity: 'Error',
      message: 'Entity "District" not found in system metadata.',
      fieldId: 2,
      ruleId: 1
    },
    {
      severity: 'Error',
      message: 'Field "Location" has invalid dependency path: Property not found.',
      fieldId: 2,
      ruleId: 3
    },
    {
      severity: 'Warning',
      message: 'Field "Location" depends on "Town" which comes after it. Reorder fields.',
      fieldId: 2,
      ruleId: 4
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component title', async () => {
    jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockResolvedValue(mockNoIssues);

    render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(screen.getByText('Configuration Health')).toBeInTheDocument();
    });
  });

  it('displays loading state on initial load', () => {
    jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockImplementation(() => new Promise(() => {}));

    render(<ConfigurationHealthPanel configurationId="1" />);

    expect(screen.getByTestId('health-check-loading')).toBeInTheDocument();
  });

  it('displays success message when no issues found', async () => {
    jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockResolvedValue(mockNoIssues);

    render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(screen.getByText(/Configuration is healthy/i)).toBeInTheDocument();
    });
  });

  it('groups issues into sections', async () => {
    jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockResolvedValue(mockIssues);

    render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(screen.getByTestId('health-section-fieldAlignment')).toBeInTheDocument();
      expect(screen.getByTestId('health-section-propertyValidation')).toBeInTheDocument();
      expect(screen.getByTestId('health-section-fieldOrdering')).toBeInTheDocument();
    });
  });

  it('refreshes health check when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockResolvedValue(mockNoIssues);

    render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledTimes(1);
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error then refreshes successfully', async () => {
    const user = userEvent.setup();
    jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce(mockNoIssues);

    render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(screen.getByText(/API Error/i)).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText(/Configuration is healthy/i)).toBeInTheDocument();
    });
  });

  it('expands issue details when clicked', async () => {
    const user = userEvent.setup();
    jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockResolvedValue(mockIssues);

    render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /details/i }).length).toBeGreaterThan(0);
    });

    const detailsButton = screen.getAllByRole('button', { name: /details/i })[0];
    await user.click(detailsButton);

    expect(screen.getByText(/Field ID: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Rule ID: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Severity: Error/i)).toBeInTheDocument();
  });

  it('automatically refreshes when configurationId changes', async () => {
    const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
      .mockResolvedValue(mockNoIssues);

    const { rerender } = render(<ConfigurationHealthPanel configurationId="1" />);

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledWith(1);
    });

    rerender(<ConfigurationHealthPanel configurationId="2" />);

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledWith(2);
    });
  });
});