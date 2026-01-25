import React from 'react';
import { CheckCircle } from 'lucide-react';

interface FormStep3Props {
  data: {
    email: string;
    password: string;
    confirmPassword: string;
    username: string;
  };
  isSubmitting?: boolean;
}

/**
 * Step 3 of registration: Review and confirm user input
 * Shows a summary of provided information before submission
 */
export const FormStep3: React.FC<FormStep3Props> = ({ data, isSubmitting = false }) => {
  return (
    <div className="space-y-6">
      {/* Review section title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
          Review Your Information
        </h3>
        <p className="text-sm text-gray-600">
          Please verify all information is correct before creating your account.
        </p>
      </div>

      {/* Review items with proper semantic structure */}
      <div className="space-y-4" role="region" aria-label="Account information summary">
        {/* Email */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Email Address</p>
            <p className="text-base font-semibold text-gray-900 mt-1 break-all">{data.email}</p>
          </div>
          <div className="text-green-600 mt-2 sm:mt-1 sm:ml-3 flex-shrink-0" aria-label="verified">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Minecraft Username */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Minecraft Username</p>
            <p className="text-base font-semibold text-gray-900 mt-1">{data.username}</p>
          </div>
          <div className="text-green-600 mt-2 sm:mt-1 sm:ml-3 flex-shrink-0" aria-label="verified">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Password */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Password</p>
            <p className="text-base font-semibold text-gray-900 mt-1">••••••••</p>
            <p className="text-xs text-gray-600 mt-1" aria-label={`password has ${data.password.length} characters`}>
              {data.password.length} characters
            </p>
          </div>
          <div className="text-green-600 mt-2 sm:mt-1 sm:ml-3 flex-shrink-0" aria-label="verified">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Terms and conditions */}
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200" role="region" aria-label="Important information">
        <h4 className="text-sm font-semibold text-amber-900 mb-2">Before You Continue</h4>
        <ul className="text-sm text-amber-800 space-y-2 list-disc list-inside">
          <li>After registration you will receive a link code to connect your Minecraft account.</li>
          <li>Your password is encrypted and stored securely.</li>
          <li>Use <code className="bg-amber-100 px-1 py-0.5 rounded">/account link [code]</code> on the server to activate your account.</li>
        </ul>
      </div>

      {/* Final confirmation */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-900">
          All information looks good. Click "Create Account" below to complete registration.
        </p>
      </div>

      {/* Loading state message */}
      {isSubmitting && (
        <div className="text-center py-4" role="status" aria-live="polite" aria-atomic="true">
          <div className="inline-block">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" aria-hidden="true" />
          </div>
          <p className="mt-2 text-sm text-gray-600">Creating your account...</p>
        </div>
      )}
    </div>
  );
};
