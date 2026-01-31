/**
 * Test utilities and helpers for component testing
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';

interface AllProvidersProps {
  children: React.ReactNode;
}

/**
 * Wrapper with all necessary providers for testing
 */
const AllProviders: React.FC<AllProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

/**
 * Custom render function that includes all providers
 */
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllProviders, ...options });
};

/**
 * Generate test email with timestamp to avoid duplicates
 */
export const generateTestEmail = (prefix = 'test') => {
  return `${prefix}+${Date.now()}@example.com`;
};

/**
 * Generate test username with timestamp to avoid duplicates
 */
export const generateTestUsername = (prefix = 'testuser') => {
  return `${prefix}_${Date.now()}`;
};

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Re-export everything from RTL
export * from '@testing-library/react';
export { renderWithProviders as render };
