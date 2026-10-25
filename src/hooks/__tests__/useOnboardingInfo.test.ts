import { authClient } from '../../apiClients/authClient';
import { fetchOnboardingInfo, isInviteSignup, resetOnboardingInfoCache } from '../useOnboardingInfo';
import { readOnboardingInfo } from '../../utils/onboardingInfoCache';
import { signupPath } from '../../utils/signupPath';
import { savePendingClaim } from '../../utils/claimCode';
import { savePendingInvite } from '../../utils/pendingInvite';

jest.mock('../../apiClients/authClient', () => ({ authClient: { onboardingInfo: jest.fn() } }));

const info = authClient.onboardingInfo as jest.Mock;
const soon = () => new Date(Date.now() + 60_000).toISOString();

describe('onboarding info (GET Auth/onboarding-info, 2026-10-25)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    resetOnboardingInfoCache();
  });

  it('asks the API once and shares the checked answer', async () => {
    info.mockResolvedValue({ registrationMode: 'Invite', accessGate: true, publicBaseUrl: 'https://app.knightsandkings.net' });

    const [a, b] = await Promise.all([fetchOnboardingInfo(), fetchOnboardingInfo()]);
    expect(await fetchOnboardingInfo()).toEqual({ registrationMode: 'Invite', accessGate: true, publicBaseUrl: 'https://app.knightsandkings.net' });
    expect(a).toBe(b);
    expect(info).toHaveBeenCalledTimes(1);
    expect(readOnboardingInfo()?.accessGate).toBe(true);
  });

  it('defaults the optional fields', async () => {
    info.mockResolvedValue({ registrationMode: 'LinkCode' });
    expect(await fetchOnboardingInfo()).toEqual({ registrationMode: 'LinkCode', accessGate: false, publicBaseUrl: '' });
  });

  it('treats an unknown mode as unknown', async () => {
    info.mockResolvedValue({ registrationMode: 'Whatever', accessGate: true });
    expect(await fetchOnboardingInfo()).toBeNull();
    expect(readOnboardingInfo()).toBeNull();
  });

  it('does not cache a failure, so the next page asks again', async () => {
    info.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ registrationMode: 'LinkCode' });

    expect(await fetchOnboardingInfo()).toBeNull();
    expect((await fetchOnboardingInfo())?.registrationMode).toBe('LinkCode');
    expect(info).toHaveBeenCalledTimes(2);
  });

  it('Invite and Open both mean sign-up with an invitation', () => {
    expect(isInviteSignup('Invite')).toBe(true);
    expect(isInviteSignup('Open')).toBe(true);
    expect(isInviteSignup('LinkCode')).toBe(false);
    expect(isInviteSignup(null)).toBe(false);
  });

  it('picks the sign-up page that continues what the player already has', () => {
    expect(signupPath('LinkCode')).toBe('/auth/register');
    expect(signupPath(null)).toBe('/auth/register');
    expect(signupPath('Invite')).toBe('/join');

    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: soon() });
    expect(signupPath('Invite')).toBe('/link');

    savePendingInvite({ token: 'tok', expiresAt: soon() });
    expect(signupPath('Invite')).toBe('/invite');
    expect(signupPath('LinkCode')).toBe('/auth/register');
  });
});
