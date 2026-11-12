import type { PermissionStatus } from '../hooks/useStaffAccess';

/**
 * Makes the mocked usePermission / usePermissions / useStaffAccess of a test answer as if the logged-in
 * user held exactly `nodes` (no wildcards). Pass the jest.fn()s the test's jest.mock of
 * hooks/useStaffAccess put in place of the real hooks.
 */
export function mockHeldNodes(
  mocks: { usePermission: jest.Mock; usePermissions?: jest.Mock; useStaffAccess?: jest.Mock },
  nodes: string[],
): void {
  const status = (node: string): PermissionStatus => (nodes.includes(node) ? 'allowed' : 'denied');
  mocks.usePermission.mockImplementation((node: string) => ({
    allowed: status(node) === 'allowed', isChecking: false, status: status(node), retry: jest.fn(),
  }));
  mocks.usePermissions?.mockImplementation((list: readonly string[]) =>
    Object.fromEntries(list.map(node => [node, status(node)])));
  const isStaff = nodes.includes('knk.admin.user.manage');
  mocks.useStaffAccess?.mockReturnValue({ isStaff, isChecking: false, status: isStaff ? 'allowed' : 'denied' });
}
