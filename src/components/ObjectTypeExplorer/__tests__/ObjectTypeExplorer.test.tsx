import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ObjectTypeExplorer, {
  getExpandedStorageKey,
  getSortStorageKey,
  ObjectTypeExplorerGroup,
} from '../ObjectTypeExplorer';
import { EntityMetadataDto } from '../../../types/dtos/metadata/MetadataModels';

const meta = (entityName: string, displayName: string): EntityMetadataDto =>
  ({ entityName, displayName, fields: [] } as unknown as EntityMetadataDto);

// Deliberately unsorted, mixed case.
const metadata: EntityMetadataDto[] = [
  meta('Town', 'Town'),
  meta('category', 'category'),
  meta('Street', 'Street'),
  meta('GateStructure', 'Gate'),
  meta('District', 'District'),
];

const groups: ObjectTypeExplorerGroup[] = [
  {
    id: 'configured',
    title: 'Entities',
    entityNames: new Set(['town', 'street']),
    defaultExpanded: true,
    collapsible: false,
  },
  {
    id: 'rest',
    title: 'Without display configuration',
    defaultExpanded: false,
    collapsible: true,
  },
];

const itemLabels = (container: HTMLElement = document.body) =>
  within(container)
    .queryAllByRole('listitem')
    .map(item => item.textContent?.trim());

const groupSection = (title: string) => screen.getByRole('region', { name: title });

describe('ObjectTypeExplorer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  describe('flat mode (no groups)', () => {
    it('renders one alphabetically sorted list without group headers', () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} />);

      expect(itemLabels()).toEqual(['category', 'District', 'Gate', 'Street', 'Town']);
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /without display configuration/i })).not.toBeInTheDocument();
    });

    it('falls back to items when no metadata is given', () => {
      render(
        <ObjectTypeExplorer
          items={[
            { id: 'town', label: 'Towns', icon: null, createRoute: '' },
            { id: 'category', label: 'Categories', icon: null, createRoute: '' },
          ]}
        />
      );

      expect(itemLabels()).toEqual(['Categories', 'Towns']);
    });

    it('hides search and sort when searchable is false', () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} searchable={false} />);

      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sort Z to A' })).not.toBeInTheDocument();
      expect(itemLabels()).toHaveLength(5);
    });
  });

  describe('search', () => {
    it('filters case-insensitively on the displayed label', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} />);

      await userEvent.type(screen.getByRole('searchbox', { name: 'Search entity types' }), 'TOW');

      expect(itemLabels()).toEqual(['Town']);
    });

    it('filters on the entity name as well as the label', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} />);

      await userEvent.type(screen.getByRole('searchbox'), 'structure');

      expect(itemLabels()).toEqual(['Gate']);
    });

    it('shows an empty state and clears with the clear button', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} />);
      const search = screen.getByRole('searchbox');

      await userEvent.type(search, 'zzz');
      expect(screen.getByText('No entity types match')).toBeInTheDocument();
      expect(itemLabels()).toEqual([]);

      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(search).toHaveValue('');
      expect(screen.queryByText('No entity types match')).not.toBeInTheDocument();
      expect(itemLabels()).toHaveLength(5);
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    });

    it('keeps the selected entity highlighted through search and sort changes', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} selectedId="street" />);
      const selected = () => screen.getByRole('button', { current: true });

      expect(selected()).toHaveTextContent('Street');
      await userEvent.type(screen.getByRole('searchbox'), 'st');
      expect(selected()).toHaveTextContent('Street');
      await userEvent.click(screen.getByRole('button', { name: 'Sort Z to A' }));
      expect(selected()).toHaveTextContent('Street');
    });

    it('calls onSelect with the entity name', async () => {
      const onSelect = jest.fn();
      render(<ObjectTypeExplorer entityMetadata={metadata} onSelect={onSelect} />);

      await userEvent.click(screen.getByRole('button', { name: 'Gate' }));

      expect(onSelect).toHaveBeenCalledWith('GateStructure');
    });
  });

  describe('sort toggle', () => {
    it('switches between A–Z and Z–A', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} />);
      const sort = screen.getByRole('button', { name: 'Sort Z to A' });

      expect(sort).toHaveAttribute('aria-pressed', 'false');
      expect(itemLabels()).toEqual(['category', 'District', 'Gate', 'Street', 'Town']);

      await userEvent.click(sort);
      expect(sort).toHaveAttribute('aria-pressed', 'true');
      expect(itemLabels()).toEqual(['Town', 'Street', 'Gate', 'District', 'category']);

      await userEvent.click(sort);
      expect(sort).toHaveAttribute('aria-pressed', 'false');
      expect(itemLabels()).toEqual(['category', 'District', 'Gate', 'Street', 'Town']);
    });

    it('sorts inside each group', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} />);
      await userEvent.click(screen.getByRole('button', { name: /Without display configuration/ }));

      expect(itemLabels(groupSection('Entities'))).toEqual(['Street', 'Town']);
      expect(itemLabels(groupSection('Without display configuration'))).toEqual(['category', 'District', 'Gate']);

      await userEvent.click(screen.getByRole('button', { name: 'Sort Z to A' }));

      expect(itemLabels(groupSection('Entities'))).toEqual(['Town', 'Street']);
      expect(itemLabels(groupSection('Without display configuration'))).toEqual(['Gate', 'District', 'category']);
    });
  });

  describe('groups', () => {
    it('puts unlisted entities in the fallback group, collapsed by default, with counts', () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} />);

      expect(within(groupSection('Entities')).getByRole('heading')).toHaveTextContent('Entities (2)');
      expect(screen.queryByRole('button', { name: /^Entities/ })).not.toBeInTheDocument();
      expect(itemLabels(groupSection('Entities'))).toEqual(['Street', 'Town']);

      const toggle = screen.getByRole('button', { name: 'Without display configuration (3)' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(itemLabels(groupSection('Without display configuration'))).toEqual([]);
    });

    it('expands and collapses the collapsible group', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} />);
      const toggle = screen.getByRole('button', { name: /Without display configuration/ });

      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(itemLabels(groupSection('Without display configuration'))).toEqual(['category', 'District', 'Gate']);

      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(itemLabels(groupSection('Without display configuration'))).toEqual([]);
    });

    it('uses the last group as fallback when no group omits entityNames', () => {
      const explicitGroups: ObjectTypeExplorerGroup[] = [
        { id: 'a', title: 'First', entityNames: new Set(['town']), defaultExpanded: true, collapsible: false },
        { id: 'b', title: 'Second', entityNames: new Set(['street']), defaultExpanded: true, collapsible: false },
      ];
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={explicitGroups} />);

      expect(itemLabels(groupSection('First'))).toEqual(['Town']);
      expect(itemLabels(groupSection('Second'))).toEqual(['category', 'District', 'Gate', 'Street']);
    });

    it('auto-expands a collapsed group that contains search matches', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} />);

      await userEvent.type(screen.getByRole('searchbox'), 'dis');

      expect(screen.queryByRole('region', { name: 'Entities' })).not.toBeInTheDocument();
      const toggle = screen.getByRole('button', { name: 'Without display configuration (1)' });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(itemLabels(groupSection('Without display configuration'))).toEqual(['District']);

      await userEvent.clear(screen.getByRole('searchbox'));
      expect(screen.getByRole('button', { name: /Without display configuration/ })).toHaveAttribute('aria-expanded', 'false');
    });

    it('lets the user collapse an auto-expanded group during a search', async () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} />);
      await userEvent.type(screen.getByRole('searchbox'), 'dis');
      const toggle = screen.getByRole('button', { name: /Without display configuration/ });

      await userEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('expands the collapsed group holding the selected entity', () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} selectedId="District" />);

      const toggle = screen.getByRole('button', { name: /Without display configuration/ });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { current: true })).toHaveTextContent('District');
    });

    it('expands for the selection when groups arrive after the first render', () => {
      const { rerender } = render(<ObjectTypeExplorer entityMetadata={metadata} selectedId="District" />);
      rerender(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} selectedId="District" />);

      expect(screen.getByRole('button', { name: /Without display configuration/ })).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not expand the collapsed group when the selection is in the first group', () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} selectedId="Town" />);

      expect(screen.getByRole('button', { name: /Without display configuration/ })).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('persistence', () => {
    it('remembers sort direction and expanded groups per storage key', async () => {
      const { unmount } = render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} storageKey="dashboard" />);

      await userEvent.click(screen.getByRole('button', { name: 'Sort Z to A' }));
      await userEvent.click(screen.getByRole('button', { name: /Without display configuration/ }));

      expect(window.localStorage.getItem(getSortStorageKey('dashboard'))).toBe('desc');
      expect(JSON.parse(window.localStorage.getItem(getExpandedStorageKey('dashboard')) ?? '{}')).toEqual({ rest: true });
      unmount();

      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} storageKey="dashboard" />);
      expect(screen.getByRole('button', { name: 'Sort Z to A' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Without display configuration/ })).toHaveAttribute('aria-expanded', 'true');
      expect(itemLabels(groupSection('Without display configuration'))).toEqual(['Gate', 'District', 'category']);
    });

    it('keeps pages independent', async () => {
      window.localStorage.setItem(getSortStorageKey('dashboard'), 'desc');

      render(<ObjectTypeExplorer entityMetadata={metadata} storageKey="forms" />);

      expect(screen.getByRole('button', { name: 'Sort Z to A' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not persist the expansion made to reveal the selection', () => {
      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} selectedId="District" storageKey="dashboard" />);

      expect(window.localStorage.getItem(getExpandedStorageKey('dashboard'))).toBeNull();
    });

    it('ignores corrupt stored values', () => {
      window.localStorage.setItem(getSortStorageKey('dashboard'), 'sideways');
      window.localStorage.setItem(getExpandedStorageKey('dashboard'), '{not json');

      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} storageKey="dashboard" />);

      expect(screen.getByRole('button', { name: 'Sort Z to A' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: /Without display configuration/ })).toHaveAttribute('aria-expanded', 'false');
    });

    it('still renders and works when localStorage throws', async () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      render(<ObjectTypeExplorer entityMetadata={metadata} groups={groups} storageKey="dashboard" />);
      expect(itemLabels(groupSection('Entities'))).toEqual(['Street', 'Town']);

      await userEvent.click(screen.getByRole('button', { name: 'Sort Z to A' }));
      await userEvent.click(screen.getByRole('button', { name: /Without display configuration/ }));

      expect(itemLabels(groupSection('Entities'))).toEqual(['Town', 'Street']);
      expect(itemLabels(groupSection('Without display configuration'))).toEqual(['Gate', 'District', 'category']);
    });
  });
});
