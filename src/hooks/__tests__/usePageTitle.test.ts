import { renderHook } from '@testing-library/react';
import { formatPageTitle, SITE_NAME, usePageTitle } from '../usePageTitle';

describe('usePageTitle', () => {
  it('formats a page title with the site name', () => {
    expect(formatPageTitle('Account')).toBe('Account · Knights & Kings');
    expect(formatPageTitle('')).toBe(SITE_NAME);
    expect(formatPageTitle(undefined)).toBe(SITE_NAME);
  });

  it('sets document.title and resets it on unmount', () => {
    const { rerender, unmount } = renderHook(({ title }) => usePageTitle(title), { initialProps: { title: 'Log in' } });
    expect(document.title).toBe('Log in · Knights & Kings');
    rerender({ title: 'Account' });
    expect(document.title).toBe('Account · Knights & Kings');
    unmount();
    expect(document.title).toBe(SITE_NAME);
  });
});
