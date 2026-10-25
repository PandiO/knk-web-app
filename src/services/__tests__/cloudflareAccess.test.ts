import {
  CloudflareSessionError,
  cloudflareSessionMissing,
  detectMissingCloudflareSession,
  isCloudflareSessionError,
  probeCloudflareSession,
  resetCloudflareProbe,
} from '../cloudflareAccess';
import { writeOnboardingInfo } from '../../utils/onboardingInfoCache';

const opaqueRedirect = () => Promise.resolve({ type: 'opaqueredirect', redirected: false, url: '' } as unknown as Response);
const plainOk = () => Promise.resolve({ type: 'basic', ok: true, redirected: false, url: 'http://api/Health' } as unknown as Response);

describe('missing Cloudflare Access session (2026-10-25)', () => {
  const gateOn = { registrationMode: 'Invite' as const, accessGate: true, publicBaseUrl: '' };
  const gateOff = { registrationMode: 'Invite' as const, accessGate: false, publicBaseUrl: '' };
  let announced: boolean[] = [];
  let subscription: { unsubscribe: () => void };

  beforeEach(() => {
    resetCloudflareProbe();
    writeOnboardingInfo(null);
    announced = [];
    subscription = cloudflareSessionMissing.subscribe(v => announced.push(v));
  });
  afterEach(() => subscription.unsubscribe());

  it('reads an opaque redirect as "Cloudflare is in the way"', async () => {
    const fetchMock = jest.fn(opaqueRedirect);
    expect(await probeCloudflareSession(fetchMock as unknown as typeof fetch)).toBe(true);
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ redirect: 'manual', credentials: 'include' });
  });

  it('reads a normal answer, or an unreachable API, as "not Cloudflare"', async () => {
    expect(await probeCloudflareSession(jest.fn(plainOk) as unknown as typeof fetch)).toBe(false);
    resetCloudflareProbe();
    expect(await probeCloudflareSession(jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch)).toBe(false);
  });

  it('reuses one verdict for a burst of failing calls', async () => {
    const fetchMock = jest.fn(opaqueRedirect);
    await Promise.all([probeCloudflareSession(fetchMock as unknown as typeof fetch), probeCloudflareSession(fetchMock as unknown as typeof fetch)]);
    await probeCloudflareSession(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('only probes when the gate is known to be on, and then announces it app-wide', async () => {
    const fetchMock = jest.fn(opaqueRedirect) as unknown as typeof fetch;

    expect(await detectMissingCloudflareSession(async () => gateOff, fetchMock)).toBe(false);
    expect(await detectMissingCloudflareSession(async () => null, fetchMock)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(announced).toEqual([]);

    expect(await detectMissingCloudflareSession(async () => gateOn, fetchMock)).toBe(true);
    expect(announced).toEqual([true]);
  });

  it('uses the cached onboarding info without asking again', async () => {
    writeOnboardingInfo(gateOn);
    const load = jest.fn(async () => gateOff);
    expect(await detectMissingCloudflareSession(load, jest.fn(opaqueRedirect) as unknown as typeof fetch)).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('marks the error so pages and the toast know', () => {
    const error = new CloudflareSessionError(new TypeError('Failed to fetch'));
    expect(isCloudflareSessionError(error)).toBe(true);
    expect(isCloudflareSessionError(new TypeError('x'))).toBe(false);
    expect(error.message).toMatch(/Cloudflare sign-in/);
  });
});
