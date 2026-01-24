import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FormStepper } from './FormStepper';
import { FormStep1 } from './FormStep1';
import { FormStep2 } from './FormStep2';
import { FormStep3 } from './FormStep3';
import { FeedbackModal } from '../FeedbackModal';
import { authClient } from '../../apiClients/authClient';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../utils/authConstants';
import { validateEmailFormat } from '../../utils/passwordValidator';

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

interface RegisterFormProps {
  onRegistrationSuccess?: (linkCode: string) => void;
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
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
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
      const linkCode = (response as any).linkCode;
      if (linkCode && onRegistrationSuccess) {
        // Will navigate to success page with link code
        setTimeout(() => {
          onRegistrationSuccess(linkCode);
        }, 1500);
      }
    } catch (error: any) {
      let errorMessage = ERROR_MESSAGES.RegistrationFailed;

      const errorCode = error?.code || error?.response?.code;
      if (errorCode === 'DuplicateEmail') {
        errorMessage = ERROR_MESSAGES.DuplicateEmail;
        setFormErrors({ email: errorMessage });
        setCurrentStep(0);
      } else if (errorCode === 'DuplicateUsername') {
        errorMessage = ERROR_MESSAGES.DuplicateUsername;
        setFormErrors({ username: errorMessage });
        setCurrentStep(1);
      } else if (error?.response?.message) {
        errorMessage = error.response.message;
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
    <div className="w-full max-w-2xl mx-auto">
      {/* Form stepper */}
      <FormStepper steps={STEPS} currentStep={currentStep} />

      {/* Form content */}
      <div className="mt-8 mb-8">
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

      {/* Navigation buttons */}
      <div className="flex gap-4 justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0 || isSubmitting}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
            currentStep === 0 || isSubmitting
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          aria-label="Go to previous step"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={isSubmitting}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
            isSubmitting
              ? 'bg-primary-light text-primary-light cursor-not-allowed opacity-50'
              : 'bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg'
          }`}
          aria-label={
            currentStep === STEPS.length - 1 ? 'Create account' : 'Go to next step'
          }
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Creating...
            </>
          ) : (
            <>
              {currentStep === STEPS.length - 1 ? 'Create Account' : 'Next'}
              {currentStep < STEPS.length - 1 && <ChevronRight className="h-5 w-5" />}
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
    </div>
  );
};
