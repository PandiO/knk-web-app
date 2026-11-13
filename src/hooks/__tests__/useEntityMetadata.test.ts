import { act, renderHook, waitFor } from '@testing-library/react';
import { useEntityMetadata } from '../useEntityMetadata';
import { metadataClient } from '../../apiClients/metadataClient';
import { entityTypeConfigurationClient } from '../../apiClients/entityTypeConfigurationClient';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../apiClients/metadataClient', () => ({
  metadataClient: { getAllEntityMetadata: jest.fn() },
}));
jest.mock('../../apiClients/entityTypeConfigurationClient', () => ({
  entityTypeConfigurationClient: { getAll: jest.fn(), update: jest.fn(), create: jest.fn() },
}));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
let mockAreaAccess = 'allowed';
jest.mock('../useStaffAccess', () => ({
  useAnyAreaNode: () => mockAreaAccess,
}));

const mockedMetadata = metadataClient.getAllEntityMetadata as jest.Mock;
const mockedConfigs = entityTypeConfigurationClient.getAll as jest.Mock;

const district = (defaultTableColumns?: string[]) => [
  { entityName: 'District', displayName: 'District', fields: [], defaultTableColumns },
];

// Smoke test G4: "Use built-in columns" saved, but a picker that was already open kept the old
// saved columns until it remounted - every hook instance held its own copy of the metadata.
describe('useEntityMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ isLoggedIn: true, isLoading: false });
    mockAreaAccess = 'allowed';
    mockedConfigs.mockResolvedValue([]);
  });

  it('gives every mounted instance the metadata another instance refreshed', async () => {
    mockedMetadata.mockResolvedValue(district(['Id', 'Name', 'TownId', 'Town']));
    const picker = renderHook(() => useEntityMetadata());
    const formsPage = renderHook(() => useEntityMetadata());
    await waitFor(() => expect(picker.result.current.baseMetadata[0]?.defaultTableColumns).toEqual(['Id', 'Name', 'TownId', 'Town']));

    mockedMetadata.mockResolvedValue(district(undefined));
    await act(async () => {
      await formsPage.result.current.refresh();
    });

    expect(formsPage.result.current.baseMetadata[0].defaultTableColumns).toBeUndefined();
    expect(picker.result.current.baseMetadata[0].defaultTableColumns).toBeUndefined();
  });

  // #280 LAM2-9: a player without an area node never asks (the API would answer 403 on every page).
  it('does not load the metadata without an area node', async () => {
    mockAreaAccess = 'denied';
    mockedMetadata.mockResolvedValue(district());
    const { result } = renderHook(() => useEntityMetadata());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.baseMetadata).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockedMetadata).not.toHaveBeenCalled();
    expect(mockedConfigs).not.toHaveBeenCalled();
  });

  it('waits for the area check before loading', async () => {
    mockAreaAccess = 'checking';
    mockedMetadata.mockResolvedValue(district());
    const { result, rerender } = renderHook(() => useEntityMetadata());
    expect(result.current.loading).toBe(true);
    expect(mockedMetadata).not.toHaveBeenCalled();
    mockAreaAccess = 'allowed';
    rerender();
    await waitFor(() => expect(result.current.baseMetadata).toHaveLength(1));
  });
});
