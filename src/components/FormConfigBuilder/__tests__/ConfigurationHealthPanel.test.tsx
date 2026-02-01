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
      ruleId: 1
    },
    {
      severity: 'Error',
      message: 'Field "Price" has no validation rules configured',
      fieldId: 3,
      ruleId: undefined
    }
  ];

  const mockIssuesWithWarnings: ValidationIssueDto[] = [
    {
      severity: 'Warning',
      message: 'Field "Location" depends on "Town" which comes AFTER it. Reorder fields for proper validation.',
      fieldId: 2,
      ruleId: 1
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

      await waitFor(() => {
        expect(screen.getByText(/Configuration Health Check/i)).toBeInTheDocument();
      });
    });

    it('displays loading state on initial load', () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ConfigurationHealthPanel configurationId="1" />);

      expect(screen.getByTestId('health-check-loading')).toBeInTheDocument();
    });

    it('renders refresh button', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
    });
  });

  describe('No Issues State', () => {
    it('displays success message when no issues found', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/Configuration is valid/i)).toBeInTheDocument();
      });
    });

    it('displays green checkmark when configuration is healthy', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        const healthIcon = screen.getByTestId('health-status-icon');
        expect(healthIcon).toHaveClass('healthy');
      });
    });
  });

  describe('Error Display', () => {
    it('displays all error issues', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithErrors);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/has validation rule depending on deleted field/i)).toBeInTheDocument();
        expect(screen.getByText(/has no validation rules configured/i)).toBeInTheDocument();
      });
    });

    it('groups issues by severity with red color for errors', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithErrors);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        const errorSection = screen.getByTestId('issues-section-Error');
        expect(errorSection).toHaveClass('error-section');
      });
    });

    it('displays error count in header', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithErrors);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
      });
    });

    it('displays field label and rule ID with each error', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithErrors);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        const errorItems = screen.getAllByTestId('issue-item');
        expect(errorItems[0]).toHaveTextContent('Location');
        expect(errorItems[0]).toHaveTextContent('Rule #1');
      });
    });
  });

  describe('Warning Display', () => {
    it('displays all warning issues', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithWarnings);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/comes AFTER it/i)).toBeInTheDocument();
      });
    });

    it('groups issues by severity with yellow color for warnings', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithWarnings);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        const warningSection = screen.getByTestId('issues-section-Warning');
        expect(warningSection).toHaveClass('warning-section');
      });
    });

    it('displays warning count in header', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithWarnings);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
      });
    });
  });

  describe('Mixed Issues Display', () => {
    it('displays both errors and warnings grouped by severity', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockMixedIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByTestId('issues-section-Error')).toBeInTheDocument();
        expect(screen.getByTestId('issues-section-Warning')).toBeInTheDocument();
      });
    });

    it('displays error count and warning count separately', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockMixedIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
        expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
      });
    });

    it('displays red status icon when errors exist', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockMixedIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        const healthIcon = screen.getByTestId('health-status-icon');
        expect(healthIcon).toHaveClass('unhealthy');
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('calls API with correct configurationId', async () => {
      const user = userEvent.setup();
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
        expect(mockValidate).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledTimes(2);
      });

      mockValidate.mockRestore();
    });

    it('shows loading state when refreshing', async () => {
      const user = userEvent.setup();
      let resolveValidation: (value: ValidationIssueDto[]) => void = () => {};
      
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockImplementation(() => new Promise(resolve => {
          resolveValidation = resolve;
        }));

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByTestId('health-check-loading')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      // Loading state should be shown again
      expect(screen.getByTestId('health-check-loading')).toBeInTheDocument();

      // Resolve the promise
      resolveValidation(mockNoIssues);

      await waitFor(() => {
        expect(screen.queryByTestId('health-check-loading')).not.toBeInTheDocument();
      });

      mockValidate.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockRejectedValue(new Error('API Error'));

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading health check/i)).toBeInTheDocument();
      });
    });

    it('displays error message with retry option', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(mockNoIssues);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading health check/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/Configuration is valid/i)).toBeInTheDocument();
      });

      mockValidate.mockRestore();
    });
  });

  describe('Expandable Issue Details', () => {
    it('expands issue details when clicked', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithErrors);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        const issueItems = screen.getAllByTestId('issue-item');
        expect(issueItems.length).toBeGreaterThan(0);
      });

      const firstIssue = screen.getAllByTestId('issue-item')[0];
      await user.click(firstIssue);

      expect(firstIssue).toHaveClass('expanded');
    });

    it('shows linked field and rule on expansion', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateConfigurationHealth')
        .mockResolvedValue(mockIssuesWithErrors);

      render(<ConfigurationHealthPanel configurationId="1" />);

      await waitFor(() => {
        const issueItems = screen.getAllByTestId('issue-item');
        expect(issueItems.length).toBeGreaterThan(0);
      });

      const firstIssue = screen.getAllByTestId('issue-item')[0];
      await user.click(firstIssue);

      expect(screen.getByText(/Jump to Field/i)).toBeInTheDocument();
      if (mockIssuesWithErrors[0].ruleId) {
        expect(screen.getByText(/Jump to Rule/i)).toBeInTheDocument();
      }
    });
  });

  describe('Auto-refresh on Configuration Change', () => {
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

      mockValidate.mockRestore();
    });
  });
});
