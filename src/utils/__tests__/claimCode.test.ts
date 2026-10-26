import {
  CLAIM_CODE_EXAMPLE,
  CLAIM_CODE_SEPARATOR,
  CLAIM_CODE_SHAPE,
  claimCodeChars,
  clearPendingClaim,
  couldBeClaimCode,
  formatClaimCode,
  loadPendingClaim,
  looksLikeClaimCode,
  normalizeClaimCode,
  savePendingClaim,
} from '../claimCode';

describe('claim codes (KNG-214)', () => {
  beforeEach(() => sessionStorage.clear());

  it('normalizes what was typed off the disconnect screen like the API does', () => {
    expect(normalizeClaimCode(' k7qh-m2xa ')).toBe('K7QHM2XA');
    expect(normalizeClaimCode('KOQH MLXI')).toBe('K0QHM1X1');
    expect(normalizeClaimCode('K7QHM2XA99')).toBe('K7QHM2XA');
    expect(formatClaimCode('k7qhm2xa')).toBe('K7QH-M2XA');
    expect(formatClaimCode('k7q')).toBe('K7Q');
  });

  it('tells a claim code typed as on the disconnect screen from a link code (2026-10-25)', () => {
    expect(looksLikeClaimCode('K7QH-M2XA')).toBe(true);
    expect(looksLikeClaimCode(' k7qh-m2xa ')).toBe(true);
    expect(looksLikeClaimCode('K7QH – M2XA')).toBe(true);
    expect(looksLikeClaimCode('K7QHM2XA')).toBe(false);
    expect(looksLikeClaimCode('ABC-DOLIL')).toBe(false);
    expect(looksLikeClaimCode('KNK-7QH4M-2XA9P')).toBe(false);
    expect(looksLikeClaimCode('')).toBe(false);
  });

  // #192: one separator for every web text and field; a dash until the testers decide.
  it('keeps the separator in one constant', () => {
    expect(CLAIM_CODE_SEPARATOR).toBe('-');
    expect(CLAIM_CODE_SHAPE).toBe('XXXX-XXXX');
    expect(CLAIM_CODE_EXAMPLE).toBe('K7QH-M2XA');
    expect(formatClaimCode('K7QHM2XA')).toBe(`K7QH${CLAIM_CODE_SEPARATOR}M2XA`);
  });

  it('also takes a claim code typed with a space between the groups', () => {
    expect(looksLikeClaimCode('k7qh m2xa')).toBe(true);
    expect(looksLikeClaimCode('K7QH  M2XA')).toBe(false);
  });

  it('reads the code characters with or without folding the look-alikes', () => {
    expect(claimCodeChars(' abcd-olil ', true)).toBe('ABCD0111');
    expect(claimCodeChars(' abcd-olil ', false)).toBe('ABCDOLIL');
    expect(claimCodeChars('abcd efgh 99', false)).toBe('ABCDEFGH');
  });

  it('knows which 8 characters could be a claim code without its dash', () => {
    expect(couldBeClaimCode('K7QHM2XA')).toBe(true);
    expect(couldBeClaimCode('ABCDOLIL')).toBe(false); // O, L and I are not Crockford
    expect(couldBeClaimCode('ABCDEFGU')).toBe(false); // nor U
    expect(couldBeClaimCode('K7QH')).toBe(false);
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
