import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingPage } from '../LandingPage';
import { useAuth } from '../../contexts/AuthContext';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

describe('LandingPage', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ isLoggedIn: false });
  });

  it('shows the alpha copy, the server address and how to join', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Knights & Kings');
    expect(screen.getByText(/closed alpha/i)).toBeInTheDocument();
    expect(screen.getByText('play.knightsandkings.net')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /how to join/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute('href', '/auth/register');
    expect(document.title).toBe('Knights & Kings');
  });

  it('copies the server address and announces it', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<LandingPage />);

    await userEvent.click(screen.getByRole('button', { name: /copy server address/i }));

    expect(writeText).toHaveBeenCalledWith('play.knightsandkings.net');
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
  });

  it('says so when copying fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
    render(<LandingPage />);

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /copy server address/i }));
    });

    expect(screen.getByRole('status')).toHaveTextContent(/copying failed/i);
  });
});
