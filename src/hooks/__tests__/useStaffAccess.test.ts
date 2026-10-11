import { renderHook, waitFor } from '@testing-library/react';
import { usePermission, useStaffAccess, STAFF_PERMISSION_NODE } from '../useStaffAccess';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { useAuth } from '../../contexts/AuthContext';
import { OWNER_PRIVACY_MANAGE_NODE, OWNER_TELEMETRY_VIEW_NODE } from '../../types/dtos/telemetry/TelemetryDtos';
import { OWNER_ANALYTICS_VIEW_NODE } from '../../types/dtos/analytics/WorldAnalyticsDtos';

jest.mock('../../apiClients/userManagementClient', () => ({
  userManagementClient: { checkPermission: jest.fn() },
}));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedCheck = userManagementClient.checkPermission as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

// The checks are cached per user and node for the page load, so every test uses its own user id.
describe('usePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a node for the logged-in user', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 101 } });
    mockedCheck.mockResolvedValue({ allowed: true });

    const { result } = renderHook(() => usePermission('knk.pmlog.read'));

    expect(result.current).toEqual({ allowed: false, isChecking: true });
    await waitFor(() => expect(result.current).toEqual({ allowed: true, isChecking: false }));
    expect(mockedCheck).toHaveBeenCalledWith(101, 'knk.pmlog.read');
  });

  it('checks each node separately and each node only once', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 102 } });
    mockedCheck.mockImplementation((_id: number, node: string) => Promise.resolve({ allowed: node === STAFF_PERMISSION_NODE }));

    const staff = renderHook(() => useStaffAccess());
    const pmLog = renderHook(() => usePermission('knk.pmlog.read'));
    const staffAgain = renderHook(() => useStaffAccess());

    await waitFor(() => expect(staff.result.current).toEqual({ isStaff: true, isChecking: false }));
    await waitFor(() => expect(pmLog.result.current).toEqual({ allowed: false, isChecking: false }));
    await waitFor(() => expect(staffAgain.result.current.isStaff).toBe(true));
    expect(mockedCheck).toHaveBeenCalledTimes(2);
  });

  it('denies when the check fails, and retries next time', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 103 } });
    mockedCheck.mockRejectedValueOnce(new Error('down'));

    const first = renderHook(() => usePermission('knk.pmlog.read'));
    await waitFor(() => expect(first.result.current).toEqual({ allowed: false, isChecking: false }));

    mockedCheck.mockResolvedValueOnce({ allowed: true });
    const second = renderHook(() => usePermission('knk.pmlog.read'));
    await waitFor(() => expect(second.result.current).toEqual({ allowed: true, isChecking: false }));
    expect(mockedCheck).toHaveBeenCalledTimes(2);
  });

  it('needs an exact grant for the telemetry and privacy owner nodes (D24)', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 104 } });
    mockedCheck.mockImplementation((_id: number, node: string) =>
      Promise.resolve({ allowed: true, matchedNode: node === OWNER_TELEMETRY_VIEW_NODE ? node : 'knk.*' }));

    const telemetry = renderHook(() => usePermission(OWNER_TELEMETRY_VIEW_NODE));
    const privacy = renderHook(() => usePermission(OWNER_PRIVACY_MANAGE_NODE));
    const analytics = renderHook(() => usePermission(OWNER_ANALYTICS_VIEW_NODE));

    await waitFor(() => expect(telemetry.result.current).toEqual({ allowed: true, isChecking: false }));
    await waitFor(() => expect(privacy.result.current).toEqual({ allowed: false, isChecking: false }));
    // Anonymous world analytics accepts a wildcard, like any other node.
    await waitFor(() => expect(analytics.result.current).toEqual({ allowed: true, isChecking: false }));
  });

  it('denies without a logged-in user', () => {
    mockedUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => usePermission('knk.pmlog.read'));

    expect(result.current).toEqual({ allowed: false, isChecking: false });
    expect(mockedCheck).not.toHaveBeenCalled();
  });
});
