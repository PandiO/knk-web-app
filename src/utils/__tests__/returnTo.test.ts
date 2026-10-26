import {
  buildLoginRedirect,
  buildReturnTo,
  dashboardPath,
  editFormPath,
  newFormPath,
  readReturnTo,
  returnToFromState,
  sanitizeReturnTo,
  withReturnTo,
} from '../returnTo';

describe('sanitizeReturnTo', () => {
  it.each([
    ['/account', '/account'],
    ['/forms/town?autoOpen=true', '/forms/town?autoOpen=true'],
    ['/display/town/4#top', '/display/town/4#top'],
    ['  /account  ', '/account'],
  ])('accepts the same-origin path %p', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/account',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    'account',
    '',
    '/auth/login',
    '/auth/register?x=1',
  ])('rejects %p', input => {
    expect(sanitizeReturnTo(input)).toBeNull();
  });

  it('rejects anything that is not a string', () => {
    expect(sanitizeReturnTo(undefined)).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo({ pathname: '/account' })).toBeNull();
  });
});

describe('returnToFromState', () => {
  it('reads ProtectedRoute\'s location state', () => {
    expect(returnToFromState({ from: { pathname: '/account/transactions', search: '?page=2', hash: '' } }))
      .toBe('/account/transactions?page=2');
  });

  it('ignores missing or unsafe state', () => {
    expect(returnToFromState(null)).toBeNull();
    expect(returnToFromState({ from: { pathname: '//evil.example' } })).toBeNull();
  });
});

describe('buildLoginRedirect', () => {
  it('adds the return path and the reason', () => {
    expect(buildLoginRedirect('/forms/town?x=1', 'expired'))
      .toBe('/auth/login?returnTo=%2Fforms%2Ftown%3Fx%3D1&reason=expired');
  });

  it('drops an unsafe or home path', () => {
    expect(buildLoginRedirect('//evil.example', 'expired')).toBe('/auth/login?reason=expired');
    expect(buildLoginRedirect('/')).toBe('/auth/login');
  });
});

describe('form links with returnTo (#177 link 1)', () => {
  it('builds the returnTo of a page from its path and query', () => {
    expect(buildReturnTo({ pathname: '/dashboard/Town', search: '' })).toBe('/dashboard/Town');
    expect(buildReturnTo({ pathname: '/forms/town', search: '?autoOpen=true' })).toBe('/forms/town?autoOpen=true');
    expect(buildReturnTo({ pathname: '/auth/login' })).toBeNull();
  });

  it('reads only a safe returnTo', () => {
    expect(readReturnTo(new URLSearchParams('returnTo=%2Fdashboard%2FTown'))).toBe('/dashboard/Town');
    expect(readReturnTo(new URLSearchParams('returnTo=https%3A%2F%2Fevil.example'))).toBeNull();
    expect(readReturnTo(new URLSearchParams('returnTo=%2F%2Fevil.example'))).toBeNull();
    expect(readReturnTo(new URLSearchParams())).toBeNull();
  });

  it('adds returnTo to the edit and new form links, and leaves it out when unsafe', () => {
    expect(editFormPath('Town', 4, '/dashboard/Town')).toBe('/forms/Town/edit/4?returnTo=%2Fdashboard%2FTown');
    expect(newFormPath('Town', '/dashboard/Town')).toBe('/forms/Town?autoOpen=true&returnTo=%2Fdashboard%2FTown');
    expect(editFormPath('Town', 4, '//evil.example')).toBe('/forms/Town/edit/4');
    expect(newFormPath('Town')).toBe('/forms/Town?autoOpen=true');
    expect(withReturnTo('/forms/Town?returnTo=%2Fold', '/new')).toBe('/forms/Town?returnTo=%2Fnew');
  });

  it('builds dashboard paths', () => {
    expect(dashboardPath('Town')).toBe('/dashboard/Town');
    expect(dashboardPath()).toBe('/dashboard');
  });
});
