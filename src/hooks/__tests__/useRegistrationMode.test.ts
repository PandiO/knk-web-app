import { authClient } from '../../apiClients/authClient';
import { fetchRegistrationMode, isInviteSignup, resetRegistrationModeCache } from '../useRegistrationMode';
import { signupPath } from '../../utils/signupPath';
import { savePendingClaim } from '../../utils/claimCode';
import { savePendingInvite } from '../../utils/pendingInvite';

jest.mock('../../apiClients/authClient', () => ({ authClient: { registrationInfo: jest.fn() } }));

const info = authClient.registrationInfo as jest.Mock;
const soon = () => new Date(Date.now() + 60_000).toISOString();

describe('registration mode (GET Auth/registration-info, 2026-10-25)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    resetRegistrationModeCache();
  });

  it('asks the API once and shares the answer', async () => {
    info.mockResolvedValue({ mode: 'Invite' });

    const [a, b] = await Promise.all([fetchRegistrationMode(), fetchRegistrationMode()]);
    expect(await fetchRegistrationMode()).toBe('Invite');
    expect(a).toBe('Invite');
    expect(b).toBe('Invite');
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('treats an unknown answer as unknown', async () => {
    info.mockResolvedValue({ mode: 'Whatever' });
    expect(await fetchRegistrationMode()).toBeNull();
  });

  it('does not cache a failure, so the next page asks again', async () => {
    info.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ mode: 'LinkCode' });

    expect(await fetchRegistrationMode()).toBeNull();
    expect(await fetchRegistrationMode()).toBe('LinkCode');
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
