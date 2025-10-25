import { useEffect } from 'react';

type SidebarItem = {
  Id?: number;
  Name?: string;
  Type: string;
};

type Props = {
  items: SidebarItem[];
  onSelect?: (type: string) => void;
  selectedId?: string;
};

const ObjectTypeExplorer = ({ items, onSelect, selectedId }: Props) => {

  useEffect(() => {
    console.log(`ObjectTypeExplorer mounted`)
  }, [])

  return (
    <div className="ObjectTypeExplorer-component">
      <div className="sidebar-list">
      <div className="sidebar-list-header">Objects</div>
      <ul className="sidebar-list-body">
        {items.map((it) => (
          <li
            key={it.Id ?? it.Name}
            className={`sidebar-list-row ${selectedId === it.Id ? 'selected' : ''}`}
            onClick={() => onSelect?.(it.Type)}
            role="button"
            tabIndex={0}
          >
            <span className="sidebar-row-title">{it.Name ?? '-'}</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  )
}

export default ObjectTypeExplorer;
