import { act, renderHook, waitFor } from '@testing-library/react';
import { usePermission, useStaffAccess, STAFF_PERMISSION_NODE, classifyPermissionError } from '../useStaffAccess';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { useAuth } from '../../contexts/AuthContext';

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

    expect(result.current).toMatchObject({ allowed: false, isChecking: true, status: 'checking' });
    await waitFor(() => expect(result.current).toMatchObject({ allowed: true, isChecking: false, status: 'allowed' }));
    expect(mockedCheck).toHaveBeenCalledWith(101, 'knk.pmlog.read');
  });

  it('checks each node separately and each node only once', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 102 } });
    mockedCheck.mockImplementation((_id: number, node: string) => Promise.resolve({ allowed: node === STAFF_PERMISSION_NODE }));

    const staff = renderHook(() => useStaffAccess());
    const pmLog = renderHook(() => usePermission('knk.pmlog.read'));
    const staffAgain = renderHook(() => useStaffAccess());

    await waitFor(() => expect(staff.result.current).toEqual({ isStaff: true, isChecking: false, status: 'allowed' }));
    await waitFor(() => expect(pmLog.result.current).toMatchObject({ allowed: false, isChecking: false, status: 'denied' }));
    await waitFor(() => expect(staffAgain.result.current.isStaff).toBe(true));
    expect(mockedCheck).toHaveBeenCalledTimes(2);
  });

  it('reports a failed check as an error (not a denial), and retries next time', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 103 } });
    mockedCheck.mockRejectedValueOnce(new Error('down'));

    const first = renderHook(() => usePermission('knk.pmlog.read'));
    await waitFor(() => expect(first.result.current).toMatchObject({ allowed: false, isChecking: false, status: 'error' }));

    mockedCheck.mockResolvedValueOnce({ allowed: true });
    const second = renderHook(() => usePermission('knk.pmlog.read'));
    await waitFor(() => expect(second.result.current).toMatchObject({ allowed: true, isChecking: false }));
    expect(mockedCheck).toHaveBeenCalledTimes(2);
  });

  it('retries on request after an error', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 106 } });
    mockedCheck.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ allowed: true });

    const { result } = renderHook(() => usePermission('knk.pmlog.read'));
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('allowed'));
  });

  it('treats a 403 as denied, and remembers it', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 104 } });
    mockedCheck.mockRejectedValueOnce({ status: 403 });
    const denied = renderHook(() => usePermission('knk.admin.content'));
    await waitFor(() => expect(denied.result.current.status).toBe('denied'));
    const again = renderHook(() => usePermission('knk.admin.content'));
    await waitFor(() => expect(again.result.current.status).toBe('denied'));
    expect(mockedCheck).toHaveBeenCalledTimes(1);
  });

  it('reports a 401 as unauthenticated, not as "staff only"', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 105 } });
    mockedCheck.mockRejectedValueOnce({ status: 401 });
    const expired = renderHook(() => usePermission('knk.admin.content'));
    await waitFor(() => expect(expired.result.current).toMatchObject({ allowed: false, isChecking: false, status: 'unauthenticated' }));
  });

  it('denies without a logged-in user', () => {
    mockedUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => usePermission('knk.pmlog.read'));

    expect(result.current).toMatchObject({ allowed: false, isChecking: false, status: 'unauthenticated' });
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it('classifies errors by status', () => {
    expect(classifyPermissionError({ status: 403 })).toBe('denied');
    expect(classifyPermissionError({ status: 401 })).toBe('unauthenticated');
    expect(classifyPermissionError(new Error('promise timeout'))).toBe('error');
  });
});
