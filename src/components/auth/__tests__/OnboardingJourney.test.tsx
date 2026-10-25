import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OnboardingJourney } from '../OnboardingJourney';

describe('OnboardingJourney (2026-10-25)', () => {
  it('has the Cloudflare step only when the gate is on', () => {
    const { rerender } = render(<OnboardingJourney accessGate={false} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText(/Cloudflare/)).not.toBeInTheDocument();
    expect(screen.getByText(/play\.knightsandkings\.net/)).toBeInTheDocument();

    rerender(<OnboardingJourney accessGate />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent(/Cloudflare/);
    expect(items[1]).toHaveTextContent(/6-digit code/);
    expect(items[1]).toHaveTextContent(/asks for your email/);
  });

  it('takes its first step from the page', () => {
    render(<OnboardingJourney accessGate={false} firstStep="Enter your invitation code." />);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Enter your invitation code.');
  });
});
