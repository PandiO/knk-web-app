import { clearPendingClaim, formatClaimCode, loadPendingClaim, normalizeClaimCode, savePendingClaim } from '../claimCode';

describe('claim codes (KNG-214)', () => {
  beforeEach(() => sessionStorage.clear());

  it('normalizes what was typed off the disconnect screen like the API does', () => {
    expect(normalizeClaimCode(' k7qh-m2xa ')).toBe('K7QHM2XA');
    expect(normalizeClaimCode('KOQH MLXI')).toBe('K0QHM1X1');
    expect(normalizeClaimCode('K7QHM2XA99')).toBe('K7QHM2XA');
    expect(formatClaimCode('k7qhm2xa')).toBe('K7QH-M2XA');
    expect(formatClaimCode('k7q')).toBe('K7Q');
  });

  it('keeps a verified code until it expires', () => {
    const now = new Date('2026-10-21T12:00:00Z');
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: '2026-10-21T12:15:00Z' });

    expect(loadPendingClaim(now)?.minecraftName).toBe('Steve');
    expect(loadPendingClaim(new Date('2026-10-21T12:15:01Z'))).toBeNull();
    // Expired codes are dropped, not just hidden.
    expect(loadPendingClaim(now)).toBeNull();
  });

  it('clears and survives junk', () => {
    savePendingClaim({ code: 'K7QHM2XA', minecraftName: 'Steve', expiresAt: '2999-01-01T00:00:00Z' });
    clearPendingClaim();
    expect(loadPendingClaim()).toBeNull();

    sessionStorage.setItem('knk.pendingClaim', '{not json');
    expect(loadPendingClaim()).toBeNull();
  });
});
