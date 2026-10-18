import { refreshAccessToken, refreshSession, setSessionExpiredHandler, singleFlight } from '../sessionRefresh';
import { serviceCall } from '../serviceCall';
import { tokenService } from '../../utils/tokenService';

type FetchArgs = [string, RequestInit];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Calls the API through serviceCall and resolves with the result or the error. */
function call(controller: string, operation: string): Promise<{ ok: boolean; value: any }> {
  return new Promise(resolve => {
    serviceCall.invokeApiService({
      controller,
      operation,
      httpMethod: 'GET',
      requestData: null,
      responseHandler: {
        success: value => resolve({ ok: true, value }),
        error: value => resolve({ ok: false, value }),
      },
    });
  });
}

const authHeader = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;

describe('singleFlight', () => {
  it('shares one in-flight call between concurrent callers, then starts a new one', async () => {
    let resolve!: (v: number) => void;
    const fn = jest.fn(() => new Promise<number>(r => { resolve = r; }));
    const once = singleFlight(fn);

    const a = once();
    const b = once();
    expect(fn).toHaveBeenCalledTimes(1);
    resolve(7);
    await expect(Promise.all([a, b])).resolves.toEqual([7, 7]);

    const c = once();
    expect(fn).toHaveBeenCalledTimes(2);
    resolve(8);
    await expect(c).resolves.toBe(8);
  });

  it('lets the next caller retry after a failure', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('ok');
    const once = singleFlight(fn);
    await expect(once()).rejects.toThrow('down');
    await expect(once()).resolves.toBe('ok');
  });
});

describe('serviceCall refresh-and-retry', () => {
  let fetchMock: jest.Mock<Promise<Response>, FetchArgs>;
  let expired: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    expired = jest.fn();
    setSessionExpiredHandler(expired);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    setSessionExpiredHandler();
    jest.restoreAllMocks();
  });

  it('refreshes once for concurrent 401s and retries each request with the new token', async () => {
    tokenService.setAccessToken('old', false);
    let releaseRefresh!: () => void;
    fetchMock.mockImplementation((url, init) => {
      if (url.endsWith('/Auth/refresh')) {
        return new Promise(resolve => {
          releaseRefresh = () => resolve(json(200, { accessToken: 'new', expiresIn: 1800 }));
        });
      }
      return Promise.resolve(authHeader(init) === 'Bearer new' ? json(200, { url }) : json(401, { error: 'Unauthorized' }));
    });

    const first = call('Towns', '');
    const second = call('Users', '1/permissions/check');
    // Let both 401s arrive and join the same refresh.
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    // Both requests got their 401 while the one refresh is still pending.
    expect(fetchMock.mock.calls.map(([url]) => url.split('/api/')[1])).toEqual(['Towns', 'Users/1/permissions/check', 'Auth/refresh']);
    releaseRefresh();

    const results = await Promise.all([first, second]);
    expect(results.every(r => r.ok)).toBe(true);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/Auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(tokenService.getAccessToken()).toBe('new');
    expect(expired).not.toHaveBeenCalled();
  });

  it('ends the session and redirects when the refresh fails', async () => {
    tokenService.setAccessToken('old', true);
    fetchMock.mockImplementation(url =>
      Promise.resolve(url.endsWith('/Auth/refresh') ? json(401, { error: 'InvalidToken' }) : json(401, {})));

    const result = await call('Towns', '');

    expect(result.ok).toBe(false);
    expect(result.value.status).toBe(401);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(tokenService.getAccessToken()).toBeNull();
  });

  it('keeps the session when the refresh fails transiently', async () => {
    tokenService.setAccessToken('old', true);
    fetchMock.mockImplementation(url =>
      Promise.resolve(url.endsWith('/Auth/refresh') ? json(503, {}) : json(401, {})));

    const result = await call('Towns', '');

    expect(result.ok).toBe(false);
    expect(result.value.status).toBe(401);
    expect(expired).not.toHaveBeenCalled();
    expect(tokenService.getAccessToken()).toBe('old');
  });

  it('does not refresh for auth endpoints or anonymous requests', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'InvalidCredentials' }));

    tokenService.setAccessToken('old', false);
    const login = await call('Auth', 'login');
    tokenService.clearAll();
    const anonymous = await call('Towns', '');

    expect(login.ok).toBe(false);
    expect(login.value.code).toBe('InvalidCredentials');
    expect(anonymous.ok).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/Auth/refresh'))).toBe(false);
    expect(expired).not.toHaveBeenCalled();
  });

  it('sends every request with credentials', async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await call('Auth', 'me');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('refreshAccessToken stores the new token and reports a gone session as false', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 'fresh', expiresIn: 1800 }));
    await expect(refreshAccessToken()).resolves.toBe(true);
    expect(tokenService.getAccessToken()).toBe('fresh');

    fetchMock.mockResolvedValueOnce(json(401, { error: 'InvalidToken' }));
    await expect(refreshAccessToken()).resolves.toBe(false);

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(refreshAccessToken()).resolves.toBe(false);
  });

  it('refreshSession tells a rejected session apart from an unreachable API', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 'fresh', expiresIn: 1800 }));
    await expect(refreshSession()).resolves.toBe('renewed');

    fetchMock.mockResolvedValueOnce(json(401, { error: 'InvalidToken' }));
    await expect(refreshSession()).resolves.toBe('rejected');

    fetchMock.mockResolvedValueOnce(json(403, {}));
    await expect(refreshSession()).resolves.toBe('rejected');

    fetchMock.mockResolvedValueOnce(json(502, {}));
    await expect(refreshSession()).resolves.toBe('unavailable');

    fetchMock.mockResolvedValueOnce(json(429, {}));
    await expect(refreshSession()).resolves.toBe('unavailable');

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(refreshSession()).resolves.toBe('unavailable');
  });
});
