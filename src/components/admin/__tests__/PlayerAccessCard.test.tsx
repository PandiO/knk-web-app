import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PlayerAccessCard } from '../PlayerAccessCard';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { usePermission } from '../../../hooks/useStaffAccess';
import { ProfileAccountDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';

jest.mock('../../../apiClients/userManagementClient', () => ({
  userManagementClient: { admit: jest.fn(), detachWebLogin: jest.fn() },
}));
jest.mock('../../../hooks/useStaffAccess', () => ({ usePermission: jest.fn() }));

const admit = userManagementClient.admit as jest.Mock;
const detach = userManagementClient.detachWebLogin as jest.Mock;
const mockedPermission = usePermission as jest.Mock;

const account = (over: Partial<ProfileAccountDto> = {}): ProfileAccountDto => ({
  id: 7, username: 'Steve', uuid: 'uuid-7', email: 'steve@example.com', coins: 0, gems: 0, experiencePoints: 0,
  emailVerified: true, gatePassThroughMethodDefault: 0 as any, activeMode: 'None', prestigeExperience: 0,
  personalSalaryMultiplier: 1, lastSalaryPayoutAt: '', isFullAccount: true, createdAt: '', isActive: true, admitted: true,
  ...over,
});

describe('PlayerAccessCard (KNG-214)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPermission.mockReturnValue({ allowed: true, isChecking: false });
  });

  it('admits a player after a confirm', async () => {
    const onChanged = jest.fn();
    admit.mockResolvedValue({ changed: true });
    render(<PlayerAccessCard account={account({ admitted: false })} onChanged={onChanged} />);

    expect(screen.getByText('Not admitted')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Admit' }));
    // The confirm dialog's own button.
    const buttons = screen.getAllByRole('button', { name: 'Admit' });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);

    await waitFor(() => expect(admit).toHaveBeenCalledWith(7));
    expect(onChanged).toHaveBeenCalled();
  });

  it('detaches the web login after a confirm, and shows the refusal on failure', async () => {
    detach.mockRejectedValue({ status: 409, response: { error: 'NoWebLogin', message: 'This account has no web login.' } });
    render(<PlayerAccessCard account={account()} onChanged={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Admit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Detach web login' }));
    const buttons = screen.getAllByRole('button', { name: 'Detach web login' });
    await userEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(detach).toHaveBeenCalledWith(7));
    expect(await screen.findByText('This account has no web login.')).toBeInTheDocument();
  });

  it('offers no detach for a web-only account or one without a web login', () => {
    const { rerender } = render(<PlayerAccessCard account={account({ uuid: null })} onChanged={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Detach web login' })).not.toBeInTheDocument();
    rerender(<PlayerAccessCard account={account({ email: null })} onChanged={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Detach web login' })).not.toBeInTheDocument();
  });

  it('is hidden without knk.admin.user.manage', () => {
    mockedPermission.mockReturnValue({ allowed: false, isChecking: false });
    const { container } = render(<PlayerAccessCard account={account({ admitted: false })} onChanged={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
