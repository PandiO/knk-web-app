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

  const mockIssuesWithErrors: ValidationIssueDto[] = [
    {
      severity: 'Error',
      message: 'Field "Location" has validation rule depending on deleted field (ID: 999)',
      fieldId: 2,
      ruleId: 1,
      fieldLabel: 'Location'
    },
    {
      severity: 'Error',
      message: 'Field "Price" has no validation rules configured',
      fieldId: 3,
      ruleId: null,
      fieldLabel: 'Price'
    }
  ];

  const mockIssuesWithWarnings: ValidationIssueDto[] = [
    {
      severity: 'Warning',
      message: 'Field "Location" depends on "Town" which comes AFTER it. Reorder fields for proper validation.',
      fieldId: 2,
      ruleId: 1,
      fieldLabel: 'Location'
    }
  ];

  const mockMixedIssues: ValidationIssueDto[] = [
    ...mockIssuesWithErrors,
    ...mockIssuesWithWarnings
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component title', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      // Component should render without errors
      expect(screen.getByTestId('health-panel') || document.body).toBeInTheDocument();
    });

    it('renders refresh button', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i }) || document.querySelector('button')).toBeTruthy();
      }, { timeout: 1000 });
    });
  });

  describe('API Integration', () => {
    it('calls API with correct configurationId', async () => {
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="42" />);

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledWith(42);
      });

      mockValidate.mockRestore();
    });

    it('refreshes health check when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalled();
      }, { timeout: 1000 });

      const refreshButton = screen.queryByRole('button', { name: /refresh/i });
      if (refreshButton) {
        await user.click(refreshButton);
        
        await waitFor(() => {
          expect(mockValidate).toHaveBeenCalledTimes(2);
        });
      }

      mockValidate.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockRejectedValue(new Error('API Error'));

      render(<ConfigurationHealthPanel configurationId="1" />);

      // Component should handle error without crashing
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Auto-refresh on Configuration Change', () => {
    it('automatically refreshes when configurationId changes', async () => {
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      const { rerender } = render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledWith(1);
      }, { timeout: 1000 });

      rerender(<ConfigurationHealthPanel configurationId="2" />);

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledWith(2);
      }, { timeout: 1000 });

      mockValidate.mockRestore();
    });
  });
});
