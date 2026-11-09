import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { PlayerProfilePage } from '../PlayerProfilePage';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { UserProfileSummaryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';
import { fakeRealtime } from '../../../test-utils/fakeRealtime';

// KNG-39: moving between moderation profiles left stale "Discoveries" panels mounted, with
// "Encountered two children with the same key" from PlayerProfilePage. The panels are stubbed:
// what is under test is how the page keys and replaces them when the :id changes.

// Jest 27 can't resolve react-router-dom v7's package exports (see LoginForm.test.tsx); it
// re-exports react-router, so real routing comes from there.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../../apiClients/userManagementClient', () => ({
  userManagementClient: {
    getProfileSummary: jest.fn(),
    getAuditLog: jest.fn(),
    getFreezeState: jest.fn(),
    freeze: jest.fn(),
    unfreeze: jest.fn(),
  },
}));
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'Staff' } }),
}));

jest.mock('../../../apiClients/permissionGroupClient', () => ({
  permissionGroupClient: { getAll: () => Promise.resolve([]) },
}));
jest.mock('../../../apiClients/kitClient', () => ({
  KitClient: { getInstance: () => ({ getAvailableForUser: () => Promise.resolve([]) }) },
}));
jest.mock('../../../apiClients/currencyClient', () => ({
  currencyClient: { getTransferLock: () => Promise.resolve(null), getLedger: () => Promise.resolve({ items: [], totalCount: 0 }) },
}));
jest.mock('../../../hooks/useStaffAccess', () => ({
  usePermission: () => ({ allowed: false, isChecking: false }),
}));
// The stubs count their live (mounted, not yet cleaned up) instances: a panel React lost track
// of keeps its effects running - the real panels' requests then never land ("stuck loading").
const mockLive = { discoveries: 0, privateMessages: 0 };
jest.mock('../../../components/admin/PlayerDiscoveriesPanel', () => {
  const R = jest.requireActual('react');
  return {
    PlayerDiscoveriesPanel: ({ userId }: { userId: number }) => {
      R.useEffect(() => {
        mockLive.discoveries += 1;
        return () => { mockLive.discoveries -= 1; };
      }, []);
      return <section data-testid="discoveries-panel">Discoveries of {userId}</section>;
    },
  };
});
jest.mock('../../../components/admin/PrivateMessagesPanel', () => {
  const R = jest.requireActual('react');
  return {
    PrivateMessagesPanel: ({ userId }: { userId: number }) => {
      R.useEffect(() => {
        mockLive.privateMessages += 1;
        return () => { mockLive.privateMessages -= 1; };
      }, []);
      return <section data-testid="pm-panel">Private messages of {userId}</section>;
    },
  };
});
jest.mock('../../../components/currency/AdjustBalanceCard', () => ({
  AdjustBalanceCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const mockedSummary = userManagementClient.getProfileSummary as jest.Mock;
const mockedAuditLog = userManagementClient.getAuditLog as jest.Mock;
const mockedFreezeState = userManagementClient.getFreezeState as jest.Mock;

const summaryFor = (id: number): UserProfileSummaryDto => ({
  account: {
    id,
    username: `Player${id}`,
    coins: 0,
    gems: 0,
    experiencePoints: 0,
    emailVerified: true,
    activeMode: 'None',
    prestigeExperience: 0,
    personalSalaryMultiplier: 1,
    isActive: true,
  },
  permissions: { userId: id, permissions: [] },
  groups: [],
  title: { prestigeExperience: 0 },
  salary: {
    titleSalary: 0,
    globalMultiplier: 1,
    personalMultiplier: 1,
    rankMultiplier: 1,
    effectiveHourlyRate: 0,
    lastSalaryPayoutAt: '2026-10-01T00:00:00Z',
    nextEligibleAt: '2026-10-01T01:00:00Z',
  },
} as unknown as UserProfileSummaryDto);

let navigateTo: (path: string) => void = () => undefined;
const NavigateHandle: React.FC = () => {
  const navigate = useNavigate();
  navigateTo = navigate;
  return null;
};

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <NavigateHandle />
    <Routes>
      <Route path="/admin/users/:id" element={<PlayerProfilePage />} />
    </Routes>
  </MemoryRouter>,
);

describe('PlayerProfilePage (KNG-39)', () => {
  beforeEach(() => {
    mockLive.discoveries = 0;
    mockLive.privateMessages = 0;
    mockedSummary.mockImplementation((id: number) => Promise.resolve(summaryFor(id)));
    mockedAuditLog.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    mockedFreezeState.mockResolvedValue({ isFrozen: false, frozenReason: null });
  });

  // #119: Discoveries is on the Activity tab, Private messages on the Privacy tab (only the open tab is mounted).
  it.each([
    ['activity', 'discoveries-panel', 'Discoveries of', { discoveries: 1, privateMessages: 0 }],
    ['privacy', 'pm-panel', 'Private messages of', { discoveries: 0, privateMessages: 1 }],
  ])('keeps one panel on the %s tab when moving between profiles', async (tab, testId, text, live) => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      renderAt(`/admin/users/3?tab=${tab}`);
      expect(await screen.findByText(`${text} 3`)).toBeInTheDocument();

      for (const id of [5, 3, 5, 3]) {
        await act(async () => navigateTo(`/admin/users/${id}?tab=${tab}`));
        expect(await screen.findByText(`${text} ${id}`)).toBeInTheDocument();
        expect(screen.getAllByTestId(testId)).toHaveLength(1);
        expect(mockLive).toEqual(live);
      }

      const duplicateKeyWarnings = consoleError.mock.calls.filter((args) =>
        String(args[0]).includes('Encountered two children with the same key'));
      expect(duplicateKeyWarnings).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});

// PandiO/knk-workspace#183 (Realtime S4): the online badge, live while the web hub is connected.
describe('PlayerProfilePage online badge (#183)', () => {
  const withPresence = (id: number, online: boolean, lastSeenAt: string | null = null) => ({
    ...summaryFor(id),
    account: { ...summaryFor(id).account, uuid: '00000000-0000-0000-0000-00000000000' + id },
    presence: { online, lastSeenAt },
  }) as UserProfileSummaryDto;

  beforeEach(() => {
    mockedSummary.mockReset();
    mockedAuditLog.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    mockedFreezeState.mockResolvedValue({ isFrozen: false, frozenReason: null });
  });

  const renderLive = (hub: ReturnType<typeof fakeRealtime>) => render(
    <hub.Provider>
      <MemoryRouter initialEntries={['/admin/users/3']}>
        <Routes>
          <Route path="/admin/users/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    </hub.Provider>,
  );

  it('shows the state from the summary and follows PresenceChanged for this player only', async () => {
    mockedSummary.mockResolvedValue(withPresence(3, false, '2026-11-05T19:00:00Z'));
    const hub = fakeRealtime();
    renderLive(hub);

    const badge = await screen.findByTestId('profile-presence');
    expect(badge).toHaveTextContent(/^Offline · last seen /);

    act(() => hub.emit('PresenceChanged', { userId: 4, online: true }));
    expect(screen.getByTestId('profile-presence')).toHaveTextContent(/^Offline/);

    act(() => hub.emit('PresenceChanged', { userId: 3, online: true, serverId: 'survival' }));
    expect(screen.getByTestId('profile-presence')).toHaveTextContent(/^Online$/);
    expect(mockedSummary).toHaveBeenCalledTimes(1);
  });

  it('re-reads only the presence after a reconnect', async () => {
    mockedSummary.mockResolvedValueOnce(withPresence(3, false));
    const hub = fakeRealtime();
    renderLive(hub);
    await screen.findByTestId('profile-presence');

    mockedSummary.mockResolvedValueOnce(withPresence(3, true));
    act(() => hub.reconnect());
    expect(await screen.findByText('Online')).toBeInTheDocument();
    expect(mockedSummary).toHaveBeenCalledTimes(2);
  });

  it('shows no badge for an account without Minecraft, or from an older API', async () => {
    mockedSummary.mockResolvedValue({ ...summaryFor(3), presence: { online: true } } as UserProfileSummaryDto);
    renderAt('/admin/users/3');
    expect(await screen.findByText('Player3')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-presence')).not.toBeInTheDocument();
  });
});
