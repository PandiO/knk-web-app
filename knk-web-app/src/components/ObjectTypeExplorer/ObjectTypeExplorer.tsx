import { useEffect, useState } from 'react';

type SidebarItem = {
  Id?: number;
  Name?: string;
  Type: string;
};

type ObjectType = { id: string; label: string; icon: React.ReactNode; route: string };


type Props = {
  items: ObjectType[];
  onSelect?: (type: string) => void;
  selectedId?: string;
};

const ObjectTypeExplorer = ({ items, onSelect, selectedId }: Props) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    console.log(`ObjectTypeExplorer mounted`)
  }, [])

  

  return (
    <>
      <aside className="ObjectTypeExplorer-component fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0" aria-label="Sidebar">
        <div className="sidebar-header">Object Type Explorer</div>
        <div className="h-full px-3 py-4 overflow-y-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-nones">
          <ul className="space-y-2 font-medium">
              {items.map((type, index) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          onSelect?.(type.id);
                        }}
                        className={`
                          w-full text-left px-4 py-2 text-sm flex items-center justify-between
                          ${selectedIndex === index
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                        role="menuitem"
                        // onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="flex items-center">
                          <span className="mr-3 text-gray-400">{type.icon}</span>
                          {type.label}
                        </span>
                        {/* <ChevronRight className="h-4 w-4 text-gray-400" /> */}
                      </button>
                    ))}
          </ul>

        </div>
      <div className="sidebar-separator" />

      </aside>
      {/* <div className="ObjectTypeExplorer-component">
        <div className="sidebar-list">
        <div className="sidebar-list-header">Objects</div>
        <ul className="sidebar-list-body">
          {items.map((it) => (
            <li
              key={it.Id ?? it.Name}
              className={`sidebar-list-row ${selectedId === String(it.Id ?? it.Name) ? 'selected' : ''}`}
              onClick={() => onSelect?.(it.Type)}
              role="button"
              tabIndex={0}
            >
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                {it.Name ?? '-'}
              </span>
            </li>
          ))}
        </ul>
      </div>
      </div> */}
    </>
    
  )
}

export default ObjectTypeExplorer;
