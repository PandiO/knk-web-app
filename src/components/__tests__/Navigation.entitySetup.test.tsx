import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { isAtOrUnder, Navigation } from '../Navigation';
import { usePermission, useStaffAccess } from '../../hooks/useStaffAccess';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn(), isLoading: false, user: { id: 7, username: 'Builder' } }),
}));
jest.mock('../../hooks/useStaffAccess', () => ({
  ...jest.requireActual('../../hooks/useStaffAccess'),
  usePermission: jest.fn(),
  useStaffAccess: jest.fn(),
}));

const mockedPermission = usePermission as jest.Mock;
const mockedStaff = useStaffAccess as jest.Mock;

/** Content staff: knk.admin.content only. */
function holdsContentNode() {
  mockedPermission.mockImplementation((node: string) => {
    const allowed = node === 'knk.admin.content';
    return { allowed, isChecking: false, status: allowed ? 'allowed' : 'denied', retry: jest.fn() };
  });
  mockedStaff.mockReturnValue({ isStaff: false, isChecking: false, status: 'denied' });
}

/** jsdom measures every width as 0, so the links live in the menu button's panel: open it. */
function renderNavAt(path: string) {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <Navigation objectTypes={[]} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  return result;
}

// PandiO/knk-workspace#197: Entity setup is opened from the dashboard's ⚙ (and by URL), not the nav.
describe('Navigation without the Entity setup link (#197)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    holdsContentNode();
  });

  it('has no Entity setup link for content staff, but keeps the Dashboard link', () => {
    const { container } = renderNavAt('/');

    expect(screen.queryByRole('menuitem', { name: /entity setup/i })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="/forms"]')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it.each([
    '/forms',
    '/forms/Town',
    '/forms/Town/edit/4',
    '/admin/form-configurations/new',
    '/admin/display-configurations/edit/3',
    '/display/Town/4',
    '/dashboard/Town',
  ])('marks Dashboard as the current page on %s', (path) => {
    renderNavAt(path);

    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Dashboard on other pages', () => {
    renderNavAt('/leaderboards');

    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('menuitem', { name: 'Leaderboards' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('isAtOrUnder', () => {
  it('matches the path itself and the pages under it only', () => {
    expect(isAtOrUnder('/forms', '/forms')).toBe(true);
    expect(isAtOrUnder('/forms/Town', '/forms')).toBe(true);
    expect(isAtOrUnder('/formsX', '/forms')).toBe(false);
    expect(isAtOrUnder('/', '/forms')).toBe(false);
  });
});
