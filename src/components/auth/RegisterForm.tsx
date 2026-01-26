import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FormStepper } from './FormStepper';
import { FormStep1 } from './FormStep1';
import { FormStep2 } from './FormStep2';
import { FormStep3 } from './FormStep3';
import { FeedbackModal } from '../FeedbackModal';
import { authClient } from '../../apiClients/authClient';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, PASSWORD_MIN_LENGTH } from '../../utils/authConstants';
import { validateEmailFormat, validatePasswordPolicy, calculatePasswordStrength } from '../../utils/passwordValidator';
import { LinkCodeResponseDto } from '../../types/dtos/auth/AuthDtos';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
}

type RegisterLinkCode = LinkCodeResponseDto & { formattedCode?: string };

interface RegisterFormProps {
  onRegistrationSuccess?: (linkCode?: RegisterLinkCode | string) => void;
}

const STEPS = ['Account Info', 'Minecraft Info', 'Review & Confirm'];

/**
 * Multi-step registration form wrapper
 * Manages form state, validation, and submission across 3 steps
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({
  onRegistrationSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    status: 'success' | 'error' | 'info';
  }>({
    open: false,
    title: '',
    message: '',
    status: 'info',
  });

  // Handle field change
  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Handle field error
  const handleError = useCallback((field: string, error: string | null) => {
    setFormErrors((prev) => ({
      ...prev,
      [field]: error || undefined,
    }));
  }, []);

  // Validate current step
  const validateStep = (): boolean => {
    const newErrors: FormErrors = {};

    if (currentStep === 0) {
      // Validate Step 1: Email & Password
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!validateEmailFormat(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else {
        const policy = validatePasswordPolicy(formData.password);
        if (!policy.isValid) {
          newErrors.password = policy.message;
        } else {
          // keep strength feedback for UX while policy is satisfied
          const strength = calculatePasswordStrength(formData.password);
          if (strength.score < 2) {
            newErrors.password = strength.feedback[0] || `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters and avoid common patterns.`;
          }
        }
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Confirm password is required';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else if (currentStep === 1) {
      // Validate Step 2: Username
      if (!formData.username.trim()) {
        newErrors.username = 'Minecraft username is required';
      }
    }
    // Step 3 has no validation; it's just a review

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return false;
    }

    return true;
  };

  // Handle next step
  const handleNext = async () => {
    if (!validateStep()) {
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit form (on step 3)
      await handleSubmit();
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await authClient.register({
        email: formData.email,
        password: formData.password,
        passwordConfirmation: formData.confirmPassword,
        username: formData.username || formData.email,
        minecraftUsername: formData.username
      });

      // Success - show feedback and trigger callback
      setFeedback({
        open: true,
        title: 'Account Created!',
        message: SUCCESS_MESSAGES.RegistrationComplete,
        status: 'success',
      });

      // Extract link code from response
      const linkCode = (response as any).linkCode as RegisterLinkCode | string | undefined;
      if (linkCode && onRegistrationSuccess) {
        // Will navigate to success page with link code
        setTimeout(() => {
          onRegistrationSuccess(linkCode);
        }, 1500);
      }
    } catch (error: any) {
      let errorMessage = ERROR_MESSAGES.RegistrationFailed;

      const errorCode = error?.code || error?.response?.code;
      const apiMessage = error?.response?.message || error?.message;
      if (errorCode === 'DuplicateEmail') {
        errorMessage = ERROR_MESSAGES.DuplicateEmail;
        setFormErrors({ email: errorMessage });
        setCurrentStep(0);
      } else if (errorCode === 'DuplicateUsername') {
        errorMessage = ERROR_MESSAGES.DuplicateUsername;
        setFormErrors({ username: errorMessage });
        setCurrentStep(1);
      } else if (apiMessage) {
        errorMessage = apiMessage;
      }

      setFeedback({
        open: true,
        title: 'Registration Failed',
        message: errorMessage,
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check username availability
  const handleCheckUsername = async (username: string): Promise<boolean> => {
    try {
      const response = await authClient.checkUsernameAvailable(username);
      return (response as any)?.available === true;
    } catch (error) {
      return false;
    }
  };

  const handleCheckEmail = async (email: string): Promise<boolean> => {
    try {
      const response = await authClient.checkEmailAvailable(email);
      return (response as any)?.available === true;
    } catch (error) {
      return false;
    }
  };

  return (
    <form className="w-full max-w-2xl mx-auto" noValidate onSubmit={(e) => {
      e.preventDefault();
      if (currentStep === STEPS.length - 1) {
        handleSubmit();
      } else {
        handleNext();
      }
    }}>
      {/* Form stepper */}
      <FormStepper steps={STEPS} currentStep={currentStep} />

      {/* Form content with proper semantic structure */}
      <div className="mt-6 sm:mt-8 mb-6 sm:mb-8">
        <div role="region" aria-label={`Step ${currentStep + 1} of ${STEPS.length}: ${STEPS[currentStep]}`} aria-live="polite">
          {currentStep === 0 && (
            <FormStep1
              data={{
                email: formData.email,
                password: formData.password,
                confirmPassword: formData.confirmPassword,
              }}
              errors={{
                email: formErrors.email,
                password: formErrors.password,
                confirmPassword: formErrors.confirmPassword,
              }}
              onChange={handleFieldChange}
              onError={handleError}
              onCheckEmail={handleCheckEmail}
            />
          )}

          {currentStep === 1 && (
            <FormStep2
              data={{
                username: formData.username,
              }}
              errors={{
                username: formErrors.username,
              }}
              onChange={handleFieldChange}
              onError={handleError}
              onCheckUsername={handleCheckUsername}
            />
          )}

          {currentStep === 2 && (
            <FormStep3
              data={formData}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>

      {/* Navigation buttons with keyboard support */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentStep === 0 || isSubmitting}
          className={`flex items-center justify-center gap-2 px-6 py-2 text-base rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
            currentStep === 0 || isSubmitting
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          aria-label="Go to previous step"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          Back
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex items-center justify-center gap-2 px-6 py-2 text-base rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
            isSubmitting
              ? 'bg-primary-light text-primary-light cursor-not-allowed opacity-50'
              : 'bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg'
          }`}
          aria-label={
            currentStep === STEPS.length - 1 ? 'Create account and continue' : 'Go to next step'
          }
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <span>
                {currentStep === STEPS.length - 1 ? 'Create Account' : 'Next'}
              </span>
              {currentStep < STEPS.length - 1 && <ChevronRight className="h-5 w-5" aria-hidden="true" />}
            </>
          )}
        </button>
      </div>

      {/* Feedback modal */}
      <FeedbackModal
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        status={feedback.status}
        onClose={() => setFeedback({ ...feedback, open: false })}
        autoCloseMs={feedback.status === 'success' ? 2000 : undefined}
      />
    </form>
  );
};
