import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayWizardPage } from '../DisplayWizardPage';

/**
 * #188 / #280: the header's Edit and Delete follow the type's action nodes; missing ones say "Requires …". #371: Edit
 * opens the form wizard and needs knk.admin.content too, except a user's Edit (the player profile).
 */

let mockParams = { entityName: 'town', id: '4' };
jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    useParams: () => mockParams,
    useLocation: () => ({ pathname: '/display/town/4', search: '' }),
    useSearchParams: () => [new URLSearchParams('')],
}), { virtual: true });
let mockHeld = new Set<string>();
jest.mock('../../hooks/useStaffAccess', () => ({
    ...jest.requireActual('../../hooks/useStaffAccess'),
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, mockHeld.has(node) ? 'allowed' : 'denied'])),
    usePermission: () => ({ allowed: true, isChecking: false, status: 'allowed', retry: jest.fn() }),
}));
jest.mock('../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({
        baseMetadata: [{
            entityName: 'Town', displayName: 'Town', fields: [], deletable: true,
            actionNodes: { edit: ['knk.admin.world'], delete: ['knk.admin.world', 'knk.admin.delete'] },
        }, {
            entityName: 'User', displayName: 'User', fields: [], deletable: true,
            actionNodes: { edit: ['knk.admin.user.manage'], delete: ['knk.admin.user.manage', 'knk.admin.delete'] },
        }],
    }),
}));
jest.mock('../../utils/entityApiMapping', () => ({ getDeleteFunctionForEntity: jest.fn() }));
jest.mock('../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../components/DisplayWizard/DisplayWizard', () => ({
    __esModule: true,
    default: ({ renderHeader }: { renderHeader?: (entity: Record<string, unknown>) => unknown }) => (
        <div>{renderHeader?.({ id: 4, name: 'Cinix' }) as never}</div>
    ),
}));

beforeEach(() => { mockParams = { entityName: 'town', id: '4' }; });

it('a staff account without knk.admin.delete sees Delete disabled with "Requires knk.admin.delete"', () => {
    mockHeld = new Set(['knk.admin.world', 'knk.admin.content']);
    render(<DisplayWizardPage />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del).toBeDisabled();
    expect(del).toHaveAccessibleDescription('Delete: Requires knk.admin.delete');
});

it('without the area node both are disabled with the reason', () => {
    mockHeld = new Set();
    render(<DisplayWizardPage />);
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAccessibleDescription('Edit: Requires knk.admin.world and knk.admin.content');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAccessibleDescription('Delete: Requires knk.admin.world and knk.admin.delete');
});

it('a world-only account sees Edit disabled with "Requires knk.admin.content" and keeps Delete (#371)', () => {
    mockHeld = new Set(['knk.admin.world', 'knk.admin.delete']);
    render(<DisplayWizardPage />);
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAccessibleDescription('Edit: Requires knk.admin.content');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
});

it('keeps a user\'s Edit (the player profile) on the user node alone (#371)', () => {
    mockParams = { entityName: 'user', id: '4' };
    mockHeld = new Set(['knk.admin.user.manage']);
    render(<DisplayWizardPage />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
});
