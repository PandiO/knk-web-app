import React from 'react';
import { calculatePasswordStrength } from '../../utils/passwordValidator';

interface PasswordStrengthMeterProps {
  password: string;
  showFeedback?: boolean;
}

/**
 * Visual password strength meter with color-coded feedback
 * Displays: strength bar, label, and improvement suggestions
 * WCAG 2.1 Level AA accessible with screen reader support
 */
export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showFeedback = true,
}) => {
  const strength = calculatePasswordStrength(password);

  return (
    <div className="space-y-2">
      {/* Strength bar (5 segments) with accessible label */}
      <div className="flex gap-1" aria-label={`Password strength: ${strength.label}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded transition-colors`}
            style={{
              backgroundColor: i < strength.score ? strength.color : '#d1d5db',
            }}
            aria-hidden="true"
            role="progressbar"
            aria-valuenow={strength.score}
            aria-valuemin={0}
            aria-valuemax={5}
          />
        ))}
      </div>

      {/* Strength label with semantic color contrast */}
      <div
        className="text-sm font-medium flex items-center gap-2"
        style={{ color: strength.color }}
        role="status"
        aria-live="polite"
      >
        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: strength.color }} />
        {strength.label}
      </div>

      {/* Feedback suggestions with proper accessibility */}
      {showFeedback && strength.feedback.length > 0 && (
        <ul
          className="text-xs text-gray-600 list-disc list-inside space-y-1 mt-2 p-3 bg-gray-50 rounded"
          role="complementary"
          aria-label="Password strength suggestions"
        >
          {strength.feedback.map((f, i) => (
            <li key={i} className="text-gray-700">
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
