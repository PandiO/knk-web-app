import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CloudflareSessionBanner } from '../CloudflareSessionBanner';
import { cloudflareSessionMissing } from '../../services/cloudflareAccess';
import { reloadPage } from '../../utils/navigation';

jest.mock('../../utils/navigation', () => ({ reloadPage: jest.fn(), fullPageLoad: jest.fn() }));

describe('CloudflareSessionBanner (2026-10-25)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is hidden until a missing session is detected, then offers the Cloudflare sign-in as a page load', async () => {
    render(<CloudflareSessionBanner />);
    expect(screen.queryByTestId('cloudflare-session-banner')).not.toBeInTheDocument();

    act(() => cloudflareSessionMissing.next(true));

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/Cloudflare sign-in has expired or isn't active on this device/);
    expect(banner).toHaveTextContent(/6-digit code/);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Cloudflare' }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('cloudflare-session-banner')).not.toBeInTheDocument();
  });
});
