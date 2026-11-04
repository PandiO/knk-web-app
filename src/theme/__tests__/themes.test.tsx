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
import { ThemeSwitcher } from '../ThemeSwitcher';
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

function renderNav() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Navigation objectTypes={[]} />
    </MemoryRouter>,
  );
}

function openAccountMenu() {
  renderNav();
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
  it('shows the switcher to everyone unless the flag is off', () => {
    expect(themePickerVisible(undefined)).toBe(true);
    expect(themePickerVisible('on')).toBe(true);
    expect(themePickerVisible('off')).toBe(false);
  });
});

describe('theme switcher (cogwheel) in the navigation (#95)', () => {
  it('is shown to players too, and the account menu no longer lists the themes', () => {
    asUser(false);
    openAccountMenu();
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Account settings', 'Log out']);
  });

  it('switches the theme without a reload, keeping its menu open', () => {
    asUser(true);
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map(option => option.querySelector('.font-medium')?.textContent)).toEqual(['Current', 'Brand', 'Brand (red)', 'Proposal']);
    expect(screen.getByRole('menuitemradio', { name: /^Current/ })).toHaveAttribute('aria-checked', 'true');
    // Opening focuses the selected theme.
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: /^Current/ }));

    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Brand Styleguide/ }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('brand');
    expect(screen.getByRole('menuitemradio', { name: /^Brand Styleguide/ })).toHaveAttribute('aria-checked', 'true');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('brand');
  });

  it('moves with the arrow keys and closes on Escape, focus back on the cogwheel', () => {
    asUser(false);
    renderNav();
    const button = screen.getByRole('button', { name: 'Theme' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.querySelector('.font-medium')?.textContent).toBe('Brand');
    // The background toggle (#231) is the last item, under the themes.
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement?.querySelector('.font-medium')?.textContent).toBe('Background image');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement?.querySelector('.font-medium')?.textContent).toBe('Proposal');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});

describe('floating theme switcher (logged out, #95)', () => {
  it('switches the theme from the cogwheel', () => {
    render(<ThemeSwitcher variant="floating" />);
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Proposal/ }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('proposal');
  });
});
