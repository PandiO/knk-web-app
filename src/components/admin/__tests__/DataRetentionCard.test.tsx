import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DataRetentionCard } from '../DataRetentionCard';
import { auditLogRetentionClient } from '../../../apiClients/auditLogRetentionClient';

jest.mock('../../../apiClients/auditLogRetentionClient', () => ({
  auditLogRetentionClient: { get: jest.fn(), update: jest.fn() },
}));

const mockedGet = auditLogRetentionClient.get as jest.Mock;
const mockedUpdate = auditLogRetentionClient.update as jest.Mock;

describe('DataRetentionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ retentionDays: 180, privateMessageRetentionDays: 30, updatedAt: '2026-09-26T12:00:00Z' });
  });

  it('shows both retention periods', async () => {
    render(<DataRetentionCard />);

    expect(await screen.findByLabelText('Audit log (days)')).toHaveValue(180);
    expect(screen.getByLabelText('Private messages (days)')).toHaveValue(30);
  });

  it('saves the private message retention together with the audit log retention', async () => {
    mockedUpdate.mockResolvedValue({ retentionDays: 180, privateMessageRetentionDays: 14, updatedAt: '2026-09-26T13:00:00Z' });
    render(<DataRetentionCard />);
    const pmDays = await screen.findByLabelText('Private messages (days)');

    await userEvent.clear(pmDays);
    await userEvent.type(pmDays, '14');
    await userEvent.click(screen.getByRole('button', { name: 'Save retention' }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith({ retentionDays: 180, privateMessageRetentionDays: 14 }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('does not save less than one day', async () => {
    render(<DataRetentionCard />);
    const pmDays = await screen.findByLabelText('Private messages (days)');

    await userEvent.clear(pmDays);
    await userEvent.type(pmDays, '0');

    expect(screen.getByText('Both values must be whole numbers of at least 1 day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save retention' })).toBeDisabled();
  });

  it("shows the API's refusal when the user lacks knk.admin.config", async () => {
    mockedUpdate.mockRejectedValue(Object.assign(new Error('Requires the knk.admin.config permission.'), { status: 403 }));
    render(<DataRetentionCard />);
    await screen.findByLabelText('Private messages (days)');

    await userEvent.click(screen.getByRole('button', { name: 'Save retention' }));

    expect(await screen.findByText('Requires the knk.admin.config permission.')).toBeInTheDocument();
  });

  it('reports a failed load', async () => {
    mockedGet.mockRejectedValue(new Error('down'));
    render(<DataRetentionCard />);

    expect(await screen.findByText('Could not load the retention settings.')).toBeInTheDocument();
  });
});
