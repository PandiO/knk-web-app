import { buildLoginRedirect, returnToFromState, sanitizeReturnTo } from '../returnTo';

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
