import { serviceCall } from '../serviceCall';
import { resetCloudflareProbe } from '../cloudflareAccess';
import { registerOnboardingInfoLoader, writeOnboardingInfo } from '../../utils/onboardingInfoCache';

// A request that dies without a response: Cloudflare Access redirecting an unauthenticated browser
// (CORS hides the redirect) looks exactly like a network failure (2026-10-25).
describe('serviceCall and a missing Cloudflare Access session', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    resetCloudflareProbe();
    writeOnboardingInfo(null);
    registerOnboardingInfoLoader(async () => null);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const call = () => new Promise<any>(resolve =>
    serviceCall.invokeApiService({
      operation: 'link-minecraft-account', controller: 'Users', httpMethod: 'POST', requestData: { linkCode: 'X' },
      responseHandler: { success: resolve, error: resolve },
    }));

  it('turns the failure into a CloudflareSessionError when the gate is on and the probe sees a redirect', async () => {
    writeOnboardingInfo({ registrationMode: 'Invite', accessGate: true, publicBaseUrl: '' });
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))             // the request itself
      .mockResolvedValueOnce({ type: 'opaqueredirect', redirected: false, url: '' }); // the probe

    const error = await call();

    expect(error.code).toBe('CloudflareSession');
    expect(error.message).toMatch(/Cloudflare sign-in/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/Health$/);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ redirect: 'manual' });
  });

  it('leaves an ordinary network failure alone when the gate is off', async () => {
    writeOnboardingInfo({ registrationMode: 'LinkCode', accessGate: false, publicBaseUrl: '' });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error = await call();

    expect(error).toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves it alone when the API is simply unreachable (the probe fails too)', async () => {
    writeOnboardingInfo({ registrationMode: 'Invite', accessGate: true, publicBaseUrl: '' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await call();

    expect(error).toBeInstanceOf(TypeError);
  });
});
