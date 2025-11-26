import { useEffect, useState } from 'react';

type SidebarItem = {
  Id?: number;
  Name?: string;
  Type: string;
};

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };


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
      {/* changed: offset from top by the navbar height (h-16) */}
      <aside className="ObjectTypeExplorer-component fixed top-16 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0" aria-label="Sidebar">
        <div className="sidebar-header">Object Type Explorer</div>
        <div className="h-full px-3 py-4 overflow-y-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-nones">
          <ul className="space-y-2 font-medium">
            {items.map((type, index) => (
              <li key={type.id}>
                <button
                  onClick={() => {
                    setSelectedIndex(index);
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
                >
                  <span className="flex items-center">
                    <span className="mr-3 text-gray-400">{type.icon}</span>
                    {type.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-separator" />
      </aside>
    </>
  )
}

export default ObjectTypeExplorer;
