import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { StaffDataDeletionCard } from '../StaffDataDeletionCard';
import { dataDeletionClient } from '../../../apiClients/dataDeletionClient';
import { usePermission } from '../../../hooks/useStaffAccess';
import { DATA_DELETION_REQUEST_NODE, PrivacyDeletionRequestDto } from '../../../types/dtos/privacy/PrivacyDtos';

jest.mock('../../../apiClients/dataDeletionClient', () => ({
  dataDeletionClient: { getForPlayer: jest.fn(), fileForPlayer: jest.fn(), cancelForPlayer: jest.fn() },
}));
jest.mock('../../../hooks/useStaffAccess', () => ({
  usePermission: jest.fn(),
}));

const api = dataDeletionClient as jest.Mocked<typeof dataDeletionClient>;
const mockedUsePermission = usePermission as jest.Mock;

const scheduled: PrivacyDeletionRequestDto = {
  id: 3,
  userId: 7,
  source: 'Staff',
  requestedAt: '2026-10-03T10:00:00Z',
  dueAt: '2026-11-02T10:00:00Z',
  status: 'Pending',
  requestedByUserId: 9,
  note: 'asked on Discord',
  scheduledAt: '2026-10-08T10:00:00Z',
  autoExecute: true,
};

describe('StaffDataDeletionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsePermission.mockReturnValue({ allowed: true, isChecking: false });
  });

  it('is hidden without the node', () => {
    mockedUsePermission.mockReturnValue({ allowed: false, isChecking: false });
    const { container } = render(<StaffDataDeletionCard userId={7} username="alice" />);

    expect(mockedUsePermission).toHaveBeenCalledWith(DATA_DELETION_REQUEST_NODE);
    expect(container).toBeEmptyDOMElement();
    expect(api.getForPlayer).not.toHaveBeenCalled();
  });

  it('files a request with a note after an explicit confirmation', async () => {
    api.getForPlayer.mockResolvedValue(null);
    api.fileForPlayer.mockResolvedValue(scheduled);
    const onChanged = jest.fn();
    render(<StaffDataDeletionCard userId={7} username="alice" onChanged={onChanged} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Request data deletion…' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete the data of alice?');
    await userEvent.type(screen.getByLabelText('Note'), 'asked on Discord');
    await userEvent.click(screen.getByRole('button', { name: 'File deletion request' }));

    expect(api.fileForPlayer).toHaveBeenCalledWith(7, 'asked on Discord');
    expect(await screen.findByText(/Scheduled for/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows and cancels a scheduled request', async () => {
    api.getForPlayer.mockResolvedValue(scheduled);
    api.cancelForPlayer.mockResolvedValue({ ...scheduled, status: 'Cancelled' });
    render(<StaffDataDeletionCard userId={7} username="alice" />);

    expect(await screen.findByText(/filed by staff/)).toBeInTheDocument();
    expect(screen.getByText(/asked on Discord/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }));

    expect(api.cancelForPlayer).toHaveBeenCalledWith(7);
    expect(await screen.findByRole('button', { name: 'Request data deletion…' })).toBeInTheDocument();
  });

  it('hides itself on a 403', async () => {
    api.getForPlayer.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    const { container } = render(<StaffDataDeletionCard userId={7} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
