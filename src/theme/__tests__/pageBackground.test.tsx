import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  PAGE_BACKGROUND_STORAGE_KEY,
  applyPageBackground,
  defaultPageBackground,
  getPageBackground,
  resolveInitialPageBackground,
  selectPageBackground,
} from '../pageBackground';
import { PageBackground } from '../PageBackgroundLayer';
import { ThemeSwitcher } from '../ThemeSwitcher';
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
  // The admin sidebar's checks (#30): no admin page in these tests.
  usePermissions: () => ({}),
}));

const mockedPermission = usePermission as jest.Mock;
const mockedStaff = useStaffAccess as jest.Mock;

function asUser(staff: boolean) {
  mockedPermission.mockReturnValue({ allowed: staff, isChecking: false, status: staff ? 'allowed' : 'denied', retry: jest.fn() });
  mockedStaff.mockReturnValue({ isStaff: staff, isChecking: false, status: staff ? 'allowed' : 'denied' });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageBackground />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  act(() => applyPageBackground('off'));
});

describe('resolveInitialPageBackground (#231)', () => {
  it('is on by default (developer decision 2026-11-04)', () => {
    expect(resolveInitialPageBackground('')).toBe('on');
  });

  it('can be turned off by default at build time (REACT_APP_PAGE_BACKGROUND=off)', () => {
    expect(defaultPageBackground('off')).toBe('off');
    expect(defaultPageBackground(undefined)).toBe('on');
    expect(defaultPageBackground('on')).toBe('on');
  });

  it("uses the visitor's own choice, so turning it off sticks", () => {
    window.localStorage.setItem(PAGE_BACKGROUND_STORAGE_KEY, 'off');
    expect(resolveInitialPageBackground('')).toBe('off');
  });

  it('lets ?bg= win for this tab only, and remembers it in the tab', () => {
    window.localStorage.setItem(PAGE_BACKGROUND_STORAGE_KEY, 'on');
    expect(resolveInitialPageBackground('?bg=off')).toBe('off');
    expect(window.localStorage.getItem(PAGE_BACKGROUND_STORAGE_KEY)).toBe('on');
    expect(resolveInitialPageBackground('')).toBe('off');
    expect(resolveInitialPageBackground('?theme=brand&bg=on')).toBe('on');
  });

  it('ignores unknown values', () => {
    window.localStorage.setItem(PAGE_BACKGROUND_STORAGE_KEY, 'maybe');
    expect(resolveInitialPageBackground('?bg=1')).toBe('on');
  });

  it('still works when storage throws (blocked site data)', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    try {
      expect(resolveInitialPageBackground('?bg=off')).toBe('off');
      expect(resolveInitialPageBackground('')).toBe('on');
      expect(() => selectPageBackground('off')).not.toThrow();
      expect(document.documentElement.getAttribute('data-page-bg')).toBe('off');
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe('selectPageBackground (#231)', () => {
  it('sets data-page-bg on <html> and saves the choice', () => {
    act(() => selectPageBackground('on'));
    expect(document.documentElement.getAttribute('data-page-bg')).toBe('on');
    expect(getPageBackground()).toBe('on');
    expect(window.localStorage.getItem(PAGE_BACKGROUND_STORAGE_KEY)).toBe('on');
  });
});

describe('PageBackground (#231)', () => {
  it('renders nothing while off, so the image is never downloaded', () => {
    renderAt('/dashboard');
    expect(screen.queryByTestId('page-background')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('puts the compressed image 1 behind the page while on: AVIF, else WebP, never the original', () => {
    act(() => applyPageBackground('on'));
    renderAt('/dashboard');
    const layer = screen.getByTestId('page-background');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.querySelector('source')).toHaveAttribute('srcset', expect.stringMatching(/\/images\/1-1920\.avif$/));
    const img = layer.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringMatching(/\/images\/1-1920\.webp$/));
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveClass('object-cover');
  });

  it('is left out on the landing page, whose slideshow already shows image 1 (one download)', () => {
    act(() => applyPageBackground('on'));
    renderAt('/');
    expect(screen.queryByTestId('page-background')).toBeNull();
  });
});

describe('background toggle in the theme switcher (#231)', () => {
  it('sits under the themes in the cogwheel menu, for every visitor, ticked by default', () => {
    act(() => applyPageBackground(resolveInitialPageBackground('')));
    render(<ThemeSwitcher variant="floating" />);
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    const toggle = screen.getByRole('menuitemcheckbox', { name: /^Background image/ });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    const items = screen.getAllByRole('menu')[0].querySelectorAll('[role^="menuitem"]');
    expect(items[items.length - 1]).toBe(toggle);
  });

  it('switches the background without a reload, keeping the menu open', () => {
    asUser(false);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navigation objectTypes={[]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Background image/ }));
    expect(document.documentElement.getAttribute('data-page-bg')).toBe('on');
    expect(screen.getByRole('menuitemcheckbox', { name: /^Background image/ })).toHaveAttribute('aria-checked', 'true');
    expect(window.localStorage.getItem(PAGE_BACKGROUND_STORAGE_KEY)).toBe('on');

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Background image/ }));
    expect(document.documentElement.getAttribute('data-page-bg')).toBe('off');
    expect(window.localStorage.getItem(PAGE_BACKGROUND_STORAGE_KEY)).toBe('off');
  });

  it('is not in the account menu any more', () => {
    asUser(true);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navigation objectTypes={[]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
  });
});
