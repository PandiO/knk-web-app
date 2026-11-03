import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getActiveTheme,
  resolveInitialTheme,
  selectTheme,
  themePickerVisible,
} from '../themes';
import { Navigation } from '../../components/Navigation';
import { usePermission, useStaffAccess } from '../../hooks/useStaffAccess';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn(), isLoading: false, user: { id: 7, username: 'Dev' } }),
}));
jest.mock('../../hooks/useStaffAccess', () => ({
  ...jest.requireActual('../../hooks/useStaffAccess'),
  usePermission: jest.fn(),
  useStaffAccess: jest.fn(),
}));

const mockedPermission = usePermission as jest.Mock;
const mockedStaff = useStaffAccess as jest.Mock;

function asUser(staff: boolean) {
  mockedPermission.mockReturnValue({ allowed: staff, isChecking: false, status: staff ? 'allowed' : 'denied', retry: jest.fn() });
  mockedStaff.mockReturnValue({ isStaff: staff, isChecking: false, status: staff ? 'allowed' : 'denied' });
}

function openAccountMenu() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Navigation objectTypes={[]} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  act(() => applyTheme('current'));
});

describe('resolveInitialTheme (#95)', () => {
  it('defaults to current', () => {
    expect(resolveInitialTheme('')).toBe('current');
  });

  it('uses the saved choice', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'brand');
    expect(resolveInitialTheme('')).toBe('brand');
  });

  it('lets ?theme= win for this tab only, and remembers it in the tab', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'brand');
    expect(resolveInitialTheme('?theme=proposal')).toBe('proposal');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('brand');
    // A reload or another page without the parameter keeps the tab's theme.
    expect(resolveInitialTheme('')).toBe('proposal');
  });

  it('accepts ?theme=brand-red', () => {
    expect(resolveInitialTheme('?theme=brand-red')).toBe('brand-red');
  });

  it('ignores unknown values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(resolveInitialTheme('?theme=dark')).toBe('current');
  });

  it('still works when storage throws (blocked site data)', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    try {
      expect(resolveInitialTheme('?theme=brand')).toBe('brand');
      expect(resolveInitialTheme('')).toBe('current');
      expect(() => selectTheme('proposal')).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('proposal');
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe('selectTheme (#95)', () => {
  it('sets data-theme on <html> and saves the choice', () => {
    act(() => selectTheme('brand'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('brand');
    expect(getActiveTheme()).toBe('brand');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('brand');
  });
});

describe('themePickerVisible (#95)', () => {
  it('shows the picker to staff only, unless the flag says otherwise', () => {
    expect(themePickerVisible(true, undefined)).toBe(true);
    expect(themePickerVisible(false, undefined)).toBe(false);
    expect(themePickerVisible(false, 'on')).toBe(true);
    expect(themePickerVisible(true, 'off')).toBe(false);
  });
});

describe('theme picker in the account menu (#95)', () => {
  it('is not shown to players', () => {
    asUser(false);
    openAccountMenu();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Log out/ })).toBeInTheDocument();
  });

  it('switches the theme for staff without a reload, keeping the menu open', () => {
    asUser(true);
    openAccountMenu();
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map(option => option.textContent)).toEqual(['Current', 'Brand', 'Brand (red)', 'Proposal']);
    expect(screen.getByRole('menuitemradio', { name: 'Current' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Brand' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('brand');
    expect(screen.getByRole('menuitemradio', { name: 'Brand' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Current' })).toHaveAttribute('aria-checked', 'false');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('brand');
  });

  it('keeps the arrow-key order: account, the themes, the background toggle (#231), log out', () => {
    asUser(true);
    openAccountMenu();
    const menu = screen.getByRole('menu');
    expect(document.activeElement).toHaveTextContent('Account settings');
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      seen.push(document.activeElement?.textContent ?? '');
    }
    expect(seen).toEqual(['Current', 'Brand', 'Brand (red)', 'Proposal', 'Background image', 'Log out']);
  });
});
