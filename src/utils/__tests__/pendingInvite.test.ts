import { clearPendingInvite, loadPendingInvite, savePendingInvite } from '../pendingInvite';

describe('pending personal invitation (2026-10-25)', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps the token until the invitation expires', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    savePendingInvite({ token: 'tok', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });

    expect(loadPendingInvite(now)).toEqual({ token: 'tok', email: 'tester@example.com', expiresAt: '2026-10-28T12:00:00Z' });
    expect(loadPendingInvite(new Date('2026-10-28T12:00:01Z'))).toBeNull();
    // Expired tokens are dropped, not just hidden.
    expect(loadPendingInvite(now)).toBeNull();
  });

  it('keeps it a day when the invitation has no expiry', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    savePendingInvite({ token: 'tok' }, now);

    expect(loadPendingInvite(new Date('2026-10-26T11:59:59Z'))?.token).toBe('tok');
    expect(loadPendingInvite(new Date('2026-10-26T12:00:00Z'))).toBeNull();
  });

  it('clears and survives junk', () => {
    savePendingInvite({ token: 'tok', expiresAt: '2999-01-01T00:00:00Z' });
    clearPendingInvite();
    expect(loadPendingInvite()).toBeNull();

    sessionStorage.setItem('knk.pendingInvite', '{not json');
    expect(loadPendingInvite()).toBeNull();
  });
});
