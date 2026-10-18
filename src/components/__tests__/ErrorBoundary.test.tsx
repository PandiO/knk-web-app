import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '../ErrorBoundary';

jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }) }), { virtual: true });

const Boom: React.FC<{ explode: boolean }> = ({ explode }) => {
  if (explode) throw new Error('render failed');
  return <p>Page content</p>;
};

describe('ErrorBoundary (X-4)', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => { consoleError = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => consoleError.mockRestore());

  it('shows a recoverable message instead of a blank page', () => {
    render(<ErrorBoundary resetKey="/a"><Boom explode /></ErrorBoundary>);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on this page');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('renders the next page again after navigation', () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Boom explode /></ErrorBoundary>);

    rerender(<ErrorBoundary resetKey="/b"><Boom explode={false} /></ErrorBoundary>);

    expect(screen.getByText('Page content')).toBeInTheDocument();
  });
});
