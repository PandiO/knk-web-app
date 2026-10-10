import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { PlayerProfilePage } from '../PlayerProfilePage';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { UserProfileSummaryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';

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
  },
}));
jest.mock('../../../apiClients/permissionGroupClient', () => ({
  permissionGroupClient: { getAll: () => Promise.resolve([]) },
}));
jest.mock('../../../apiClients/kitClient', () => ({
  KitClient: { getInstance: () => ({ getAvailableForUser: () => Promise.resolve([]) }) },
}));
jest.mock('../../../apiClients/currencyClient', () => ({
  currencyClient: { getTransferLock: () => Promise.resolve(null) },
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
  });

  it('keeps one Discoveries and one Private messages panel when moving between profiles', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      renderAt('/admin/users/3');
      expect(await screen.findByText('Discoveries of 3')).toBeInTheDocument();

      for (const id of [5, 3, 5, 3]) {
        await act(async () => navigateTo(`/admin/users/${id}`));
        expect(await screen.findByText(`Discoveries of ${id}`)).toBeInTheDocument();
        expect(screen.getAllByTestId('discoveries-panel')).toHaveLength(1);
        expect(screen.getAllByTestId('pm-panel')).toHaveLength(1);
        expect(screen.getByText(`Private messages of ${id}`)).toBeInTheDocument();
        expect(mockLive).toEqual({ discoveries: 1, privateMessages: 1 });
      }

      const duplicateKeyWarnings = consoleError.mock.calls.filter((args) =>
        String(args[0]).includes('Encountered two children with the same key'));
      expect(duplicateKeyWarnings).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
