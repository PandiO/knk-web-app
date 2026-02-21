import { useMemo } from 'react';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };


type Props = {
  items?: ObjectType[];
  entityMetadata?: EntityMetadataDto[];
  onSelect?: (type: string) => void;
  selectedId?: string;
};

const ObjectTypeExplorer = ({ items = [], entityMetadata = [], onSelect, selectedId }: Props) => {
  const sourceItems = useMemo(() => {
    if (entityMetadata.length > 0) {
      return entityMetadata.map(meta => ({
        id: meta.entityName,
        label: meta.displayName || meta.entityName,
      }));
    }

    return items.map(type => ({
      id: type.id,
      label: type.label,
    }));
  }, [entityMetadata, items]);

  return (
    <>
      {/* changed: offset from top by the navbar height (h-16) */}
      <aside className="ObjectTypeExplorer-component fixed top-16 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0" aria-label="Sidebar">
        <div className="sidebar-header">Object Type Explorer</div>
        <div className="h-full px-3 py-4 overflow-y-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-nones">
          <ul className="space-y-2 font-medium">
            {sourceItems.map((type) => (
              <li key={type.id}>
                <button
                  onClick={() => {
                    onSelect?.(type.id);
                  }}
                  className={`
                    w-full text-left px-4 py-2 text-sm flex items-center justify-between
                    ${selectedId === type.id
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  role="menuitem"
                >
                  <span className="flex items-center">
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
