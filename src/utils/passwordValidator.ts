import { WEAK_PASSWORDS, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './authConstants';

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  feedback: string[];
}

/**
 * Calculate password strength based on multiple criteria
 * Follows OWASP recommendations: length over complexity
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: 'Too short',
      color: '#dc2626', // Red
      feedback: [`Password must be at least ${PASSWORD_MIN_LENGTH} characters`],
    };
  }

  let score = 0;
  const feedback: string[] = [];

  // Check length (primary criterion per OWASP)
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Check variety (secondary criteria)
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLowercase && hasUppercase) {
    score += 1; // Mixed case
  }

  if (hasNumbers) {
    score += 0.5; // Numbers (optional but good)
  }

  if (hasSymbols) {
    score += 0.5; // Symbols (optional but good)
  }

  // Check for weak patterns
  if (isWeakPassword(password)) {
    score = Math.max(0, score - 3);
    feedback.push('This password is commonly used. Choose something more unique.');
  }

  // Check for keyboard patterns
  if (hasKeyboardPattern(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid keyboard patterns like qwerty, asdf, etc.');
  }

  // Check for sequential/repeated chars
  if (hasSequentialChars(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid sequential characters like 123 or abc.');
  }

  if (hasRepeatedChars(password)) {
    score = Math.max(0, score - 0.5);
    feedback.push('Avoid repeating characters like aaa or 111.');
  }

  // Map score to label & color
  const finalScore = Math.min(5, Math.ceil(score));
  const strengthMap = [
    { label: 'Very Weak', color: '#dc2626' }, // Red
    { label: 'Weak', color: '#ea580c' }, // Orange
    { label: 'Fair', color: '#eab308' }, // Yellow
    { label: 'Good', color: '#84cc16' }, // Light Green
    { label: 'Strong', color: '#22c55e' }, // Green
    { label: 'Very Strong', color: '#16a34a' }, // Dark Green
  ];

  const strength = strengthMap[finalScore];

  // Add positive feedback
  if (finalScore >= 4 && feedback.length === 0) {
    feedback.push('Strong password choice!');
  }

  return {
    score: finalScore as 0 | 1 | 2 | 3 | 4 | 5,
    label: strength.label,
    color: strength.color,
    feedback,
  };
}

/**
 * Check if password is in weak password list
 */
function isWeakPassword(password: string): boolean {
  return WEAK_PASSWORDS.has(password.toLowerCase());
}

/**
 * Check for common keyboard patterns
 */
function hasKeyboardPattern(password: string): boolean {
  const patterns = [
    'qwerty',
    'qwertz',
    'asdf',
    'zxcv',
    'qazwsx',
    '12345',
    '123456',
    '98765',
    'abcdef',
  ];
  const lowerPassword = password.toLowerCase();
  return patterns.some((p) => lowerPassword.includes(p));
}

/**
 * Check for sequential characters (e.g., abc, 123)
 */
function hasSequentialChars(password: string): boolean {
  for (let i = 0; i < password.length - 2; i++) {
    const code1 = password.charCodeAt(i);
    const code2 = password.charCodeAt(i + 1);
    const code3 = password.charCodeAt(i + 2);

    // Check if 3 consecutive chars are sequential
    if (code2 === code1 + 1 && code3 === code2 + 1) {
      return true;
    }
  }
  return false;
}

/**
 * Check for repeated characters (e.g., aaa, 111)
 */
function hasRepeatedChars(password: string): boolean {
  // Look for 3+ repeated characters
  const repeated = /(.)\1{2,}/.test(password);
  return repeated;
}

/**
 * Validate email format (simplified RFC 5322)
 */
export function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format (Minecraft compatible)
 * Allows alphanumeric and underscore, 3-16 characters
 */
export function validateUsernameFormat(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password length
 */
export function validatePasswordLength(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}
