import React from 'react';
import { calculatePasswordStrength } from '../../utils/passwordValidator';

interface PasswordStrengthMeterProps {
  password: string;
  showFeedback?: boolean;
}

/**
 * Visual password strength meter with color-coded feedback
 * Displays: strength bar, label, and improvement suggestions
 */
export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showFeedback = true,
}) => {
  const strength = calculatePasswordStrength(password);

  return (
    <div className="space-y-2">
      {/* Strength bar (5 segments) */}
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded transition-colors ${
              i < strength.score ? 'opacity-100' : 'opacity-25'
            }`}
            style={{
              backgroundColor: i < strength.score ? strength.color : '#d1d5db',
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Strength label */}
      <div className="text-sm font-medium" style={{ color: strength.color }}>
        {strength.label}
      </div>

      {/* Feedback suggestions */}
      {showFeedback && strength.feedback.length > 0 && (
        <ul
          className="text-xs text-gray-600 list-disc list-inside space-y-1"
          role="status"
          aria-live="polite"
          aria-label="Password strength feedback"
        >
          {strength.feedback.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
