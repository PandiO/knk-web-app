import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FieldRenderer from '../FieldRenderer';
import * as fieldValidationRuleClient from '../../../apiClients/fieldValidationRuleClient';
import { FormField } from '../../../types';
import { ValidationResultDto } from '../../../types/dtos/forms/FieldValidationRuleDtos';

jest.mock('../../../apiClients/fieldValidationRuleClient');

describe('FieldRenderer - Validation Execution', () => {
  const mockFormField: FormField = {
    id: 1,
    label: 'Location',
    fieldType: 'number',
    formStepId: 1,
    required: false,
    order: 0,
    placeholder: 'Select a location'
  };

  const mockValidationSuccess: ValidationResultDto = {
    isValid: true,
    isBlocking: false,
    message: 'Location is valid',
    placeholders: {}
  };

  const mockValidationFailure: ValidationResultDto = {
    isValid: false,
    isBlocking: true,
    message: 'Location must be within the region',
    placeholders: { regionName: 'Town Square' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation Execution on Value Change', () => {
    it('calls validation API when field value changes', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationSuccess);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalled();
      });

      mockValidate.mockRestore();
    });

    it('includes form context data in validation request', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationSuccess);

      const formContextData = { townId: 5, regionId: 'region_1' };

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={formContextData}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledWith(
          expect.objectContaining({
            formContextData
          })
        );
      });

      mockValidate.mockRestore();
    });

    it('debounces validation requests (300ms delay)', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationSuccess);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      
      // Type multiple characters quickly
      await user.type(input, '123', { delay: 50 });

      // First call should be debounced
      expect(mockValidate).not.toHaveBeenCalled();

      // Wait for debounce timeout
      await waitFor(
        () => {
          expect(mockValidate).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      mockValidate.mockRestore();
    });
  });

  describe('Validation Success Feedback', () => {
    it('displays success message when validation passes', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationSuccess);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        expect(screen.getByText('Location is valid')).toBeInTheDocument();
      });
    });

    it('displays green checkmark on success', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationSuccess);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        const successIcon = screen.getByTestId('validation-success-icon');
        expect(successIcon).toBeInTheDocument();
      });
    });
  });

  describe('Validation Failure Feedback', () => {
    it('displays error message when blocking validation fails', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationFailure);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '999');

      await waitFor(() => {
        expect(screen.getByText('Location must be within the region')).toBeInTheDocument();
      });
    });

    it('displays red X on blocking error', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationFailure);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '999');

      await waitFor(() => {
        const errorIcon = screen.getByTestId('validation-error-icon');
        expect(errorIcon).toBeInTheDocument();
      });
    });

    it('highlights field with red border on error', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationFailure);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '999');

      await waitFor(() => {
        expect(input).toHaveClass('error');
      });
    });
  });

  describe('Placeholder Interpolation', () => {
    it('interpolates placeholders in error messages', async () => {
      const user = userEvent.setup();
      const failureWithPlaceholders: ValidationResultDto = {
        isValid: false,
        isBlocking: true,
        message: 'Location {coordinates} is outside region {regionName}',
        placeholders: {
          coordinates: '(X: 100, Z: 200)',
          regionName: 'Town Square'
        }
      };

      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(failureWithPlaceholders);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '999');

      await waitFor(() => {
        expect(screen.getByText('Location (X: 100, Z: 200) is outside region Town Square')).toBeInTheDocument();
      });
    });
  });

  describe('Dependent Field Validation', () => {
    it('re-validates dependent fields when dependency changes', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationSuccess);

      const { rerender } = render(
        <FieldRenderer
          field={mockFormField}
          value="123"
          onChange={jest.fn()}
          formContextData={{ townId: 1 }}
          dependsOnFields={[{ fieldId: 2 }]}
        />
      );

      // Change the dependency context
      rerender(
        <FieldRenderer
          field={mockFormField}
          value="123"
          onChange={jest.fn()}
          formContextData={{ townId: 2 }}
          dependsOnFields={[{ fieldId: 2 }]}
        />
      );

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledTimes(2);
      });

      mockValidate.mockRestore();
    });
  });

  describe('Pending Validation State', () => {
    it('displays pending message when dependency is not filled', async () => {
      const user = userEvent.setup();
      const pendingResult: ValidationResultDto = {
        isValid: true,
        isBlocking: false,
        message: 'Validation pending until Town is filled',
        placeholders: {}
      };

      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(pendingResult);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        expect(screen.getByText('Validation pending until Town is filled')).toBeInTheDocument();
      });
    });

    it('displays loading spinner while validation is in progress', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockImplementation(() => new Promise(resolve => {
          setTimeout(() => resolve(mockValidationSuccess), 500);
        }));

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      // Loading spinner should appear during validation
      expect(screen.getByTestId('validation-loading')).toBeInTheDocument();

      // Wait for validation to complete
      await waitFor(() => {
        expect(screen.queryByTestId('validation-loading')).not.toBeInTheDocument();
      });

      mockValidate.mockRestore();
    });
  });

  describe('Non-Blocking Validation', () => {
    it('displays warning for non-blocking validation failures', async () => {
      const user = userEvent.setup();
      const warningResult: ValidationResultDto = {
        isValid: false,
        isBlocking: false,
        message: 'Warning: Location is near boundary',
        placeholders: {}
      };

      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(warningResult);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        expect(screen.getByText('Warning: Location is near boundary')).toBeInTheDocument();
        const warningIcon = screen.getByTestId('validation-warning-icon');
        expect(warningIcon).toBeInTheDocument();
      });
    });

    it('allows form submission with non-blocking validation warnings', async () => {
      const user = userEvent.setup();
      const warningResult: ValidationResultDto = {
        isValid: false,
        isBlocking: false,
        message: 'Warning: Location is near boundary',
        placeholders: {}
      };

      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(warningResult);

      const mockSubmit = jest.fn();

      render(
        <form onSubmit={mockSubmit}>
          <FieldRenderer
            field={mockFormField}
            value="123"
            onChange={jest.fn()}
            formContextData={{}}
          />
          <button type="submit">Submit</button>
        </form>
      );

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      expect(mockSubmit).toHaveBeenCalled();
    });

    it('prevents form submission with blocking validation errors', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationFailure);

      const mockSubmit = jest.fn();

      render(
        <form onSubmit={mockSubmit}>
          <FieldRenderer
            field={mockFormField}
            value="999"
            onChange={jest.fn()}
            formContextData={{}}
          />
          <button type="submit">Submit</button>
        </form>
      );

      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      // Button should be disabled or validation should prevent submission
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('handles validation API errors gracefully', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockRejectedValue(new Error('API Error'));

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        expect(screen.getByText(/validation error/i)).toBeInTheDocument();
      });
    });

    it('clears validation message when field is cleared', async () => {
      const user = userEvent.setup();
      jest.spyOn(fieldValidationRuleClient, 'validateField')
        .mockResolvedValue(mockValidationSuccess);

      render(
        <FieldRenderer
          field={mockFormField}
          value=""
          onChange={jest.fn()}
          formContextData={{}}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '123');

      await waitFor(() => {
        expect(screen.getByText('Location is valid')).toBeInTheDocument();
      });

      await user.clear(input);

      await waitFor(() => {
        expect(screen.queryByText('Location is valid')).not.toBeInTheDocument();
      });
    });
  });
});
