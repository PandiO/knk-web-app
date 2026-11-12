import { describeAllNodes } from '../useActionGate';

/** #188: actions that need every node of a list (metadata actionNodes, a relationship's nodes). */
describe('describeAllNodes', () => {
  it('allows when every node is held, names the missing ones otherwise', () => {
    expect(describeAllNodes(['a', 'b'], { a: 'allowed', b: 'allowed' })).toEqual({ nodes: ['a', 'b'], allowed: true, checking: false, hint: null });
    expect(describeAllNodes(['knk.admin.world', 'knk.admin.delete'], { 'knk.admin.world': 'allowed', 'knk.admin.delete': 'denied' }))
      .toMatchObject({ allowed: false, checking: false, hint: 'Requires knk.admin.delete' });
    expect(describeAllNodes(['a', 'b'], { a: 'denied', b: 'unauthenticated' }).hint).toBe('Requires a and b');
  });

  it('waits while checking, says when a check failed, and allows an empty list', () => {
    expect(describeAllNodes(['a'], { a: 'checking' })).toMatchObject({ allowed: false, checking: true, hint: null });
    expect(describeAllNodes(['a'], { a: 'error' })).toMatchObject({ allowed: false, hint: "Couldn't check a" });
    expect(describeAllNodes([], {})).toMatchObject({ allowed: true, hint: null });
  });
});
