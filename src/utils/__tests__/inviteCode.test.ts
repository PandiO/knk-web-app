import { INVITE_CODE_SHAPE, formatInviteCode, inviteCodeChars } from '../inviteCode';

describe('invitation codes (#208)', () => {
  it('keeps the 10 code characters of a pasted or typed code', () => {
    expect(inviteCodeChars('KNK-7QH4M-2XA9P')).toBe('7QH4M2XA9P');
    expect(inviteCodeChars('knk7qh4m2xa9p')).toBe('7QH4M2XA9P');
    expect(inviteCodeChars(' knk - 7qh4m - 2xa9p ')).toBe('7QH4M2XA9P');
    expect(inviteCodeChars('7QH4M-2XA9P')).toBe('7QH4M2XA9P');
    expect(inviteCodeChars('7qh4m 2xa9p')).toBe('7QH4M2XA9P');
  });

  it('keeps a code that itself starts with KNK', () => {
    expect(inviteCodeChars('KNKAB-CDEFG')).toBe('KNKABCDEFG');
    expect(inviteCodeChars('KNK-KNKAB-CDEFG')).toBe('KNKABCDEFG');
  });

  it('folds the look-alikes and stops at 10 characters', () => {
    expect(inviteCodeChars('KNK-OIL00-11111')).toBe('0110011111');
    expect(inviteCodeChars('ABCDEFGHJKMN')).toBe('ABCDEFGHJK');
  });

  it('formats the whole code for the API', () => {
    expect(formatInviteCode('7QH4M2XA9P')).toBe('KNK-7QH4M-2XA9P');
    expect(formatInviteCode('7QH')).toBe('KNK-7QH');
    expect(INVITE_CODE_SHAPE).toBe('KNK-XXXXX-XXXXX');
  });
});
