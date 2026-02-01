import React, { useState } from 'react';
import { validateUsernameFormat } from '../../utils/passwordValidator';
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } from '../../utils/authConstants';

interface FormStep2Props {
  data: {
    username: string;
    linkCode?: string;
  };
  errors: {
    username?: string;
    linkCode?: string;
  };
  onChange: (field: string, value: string) => void;
  onError: (field: string, error: string | null) => void;
  onCheckUsername?: (username: string) => Promise<boolean>; // Check availability
}

/**
 * Step 2 of registration: Minecraft username entry
 * Includes format validation and availability check
 */
export const FormStep2: React.FC<FormStep2Props> = ({
  data,
  errors,
  onChange,
  onError,
  onCheckUsername,
}) => {
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Validate username on blur
  const handleUsernameBlur = async () => {
    const username = data.username.trim();

    if (!username) {
      onError('username', 'Minecraft username is required');
      return;
    }

    if (!validateUsernameFormat(username)) {
      onError(
        'username',
        `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} alphanumeric characters (underscore allowed)`
      );
      return;
    }

    // Check availability if API provided
    if (onCheckUsername && username.length >= USERNAME_MIN_LENGTH) {
      setIsCheckingAvailability(true);
      try {
        const available = await onCheckUsername(username);
        if (!available) {
          onError('username', 'This username is already taken. Try a variation.');
          setUsernameAvailable(false);
        } else {
          onError('username', null);
          setUsernameAvailable(true);
        }
      } catch (error) {
        console.error('Failed to check username availability:', error);
        onError('username', 'Unable to verify username. Please try again.');
        setUsernameAvailable(null);
      } finally {
        setIsCheckingAvailability(false);
      }
    } else {
      onError('username', null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Minecraft username field */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
          Minecraft Username <span aria-label="required">*</span>
        </label>
        <div className="relative">
          <input
            id="username"
            type="text"
            inputMode="text"
            autoComplete="off"
            data-testid="username"
            value={data.username}
            onChange={(e) => {
              onChange('username', e.target.value);
              setUsernameAvailable(null);
            }}
            onBlur={handleUsernameBlur}
            maxLength={USERNAME_MAX_LENGTH}
            className={`w-full px-4 py-2 text-base pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              errors.username
                ? 'border-red-500 focus:ring-red-500'
                : usernameAvailable
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-primary'
            }`}
            placeholder={`e.g., PlayerName or Player_123`}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? 'username-error' : 'username-help'}
            required
          />

          {/* Status indicator */}
          {isCheckingAvailability && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-5 w-5 text-blue-500">
                <div className="h-full w-full border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            </div>
          )}
          {usernameAvailable === true && !isCheckingAvailability && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
              ✓
            </div>
          )}
        </div>

        {errors.username && (
          <p id="username-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.username}
          </p>
        )}

        <p id="username-help" className="mt-2 text-xs text-gray-600">
          {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters, alphanumeric and underscore
          allowed
        </p>
      </div>

      {/* Optional link code field */}
      <div>
        <label htmlFor="linkCode" className="block text-sm font-medium text-gray-700 mb-2">
          Link Code <span className="text-xs text-gray-500">(optional)</span>
        </label>
        <input
          id="linkCode"
          type="text"
          inputMode="text"
          autoComplete="off"
          data-testid="linkCode"
          value={data.linkCode || ''}
          onChange={(e) => {
            onChange('linkCode', e.target.value);
            onError('linkCode', null);
          }}
          className={`w-full px-4 py-2 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.linkCode ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
          }`}
          placeholder="Enter code from Minecraft (optional)"
          aria-invalid={!!errors.linkCode}
          aria-describedby={errors.linkCode ? 'linkcode-error' : 'linkcode-help'}
        />

        {errors.linkCode && (
          <p id="linkcode-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.linkCode}
          </p>
        )}

        <p id="linkcode-help" className="mt-2 text-xs text-gray-600">
          If you started in Minecraft, use <span className="font-mono">/account link</span> to get a code and enter it here.
        </p>
      </div>

      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>What this does:</strong> Your Minecraft username links your web account to your in-game player when you join the server.
        </p>
      </div>

      {/* Character counter */}
      {data.username && (
        <div className="text-xs text-gray-500">
          {data.username.length} / {USERNAME_MAX_LENGTH} characters
        </div>
      )}
    </div>
  );
};
