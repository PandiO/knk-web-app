// ActionButtons Component - Renders dynamic action buttons based on configuration
import React from 'react';
import { Eye, Edit, Plus, Link, Unlink, Trash2, PlusCircle } from 'lucide-react';
import { ActionButtonsConfigDto, DisplayAction } from '../../types/displayConfiguration';

interface ActionButtonsProps {
  config: ActionButtonsConfigDto;
  isCollection: boolean;
  entityType?: string;
  entityData?: Record<string, unknown>;
  onActionClick?: (action: DisplayAction) => void;
  isItemLevel?: boolean; // For collection items
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  config,
  isCollection,
  entityType,
  entityData,
  onActionClick,
  isItemLevel = false
}) => {
  if (!onActionClick || !entityType) return null;

  const handleClick = (type: DisplayAction['type']) => {
    onActionClick({
      type,
      entityType,
      entityId: entityData?.id as number | undefined
    });
  };

  return (
    <div className={`flex flex-wrap gap-2 ${isItemLevel ? 'mt-3 pt-3 border-t border-gray-200' : 'mt-4'}`}>
      {/* Common buttons */}
      {config.showViewButton && entityData && (
        <button 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
          onClick={() => handleClick('view')}
        >
          <Eye size={16} />
          View
        </button>
      )}
      
      {config.showEditButton && entityData && (
        <button 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors"
          onClick={() => handleClick('edit')}
        >
          <Edit size={16} />
          Edit
        </button>
      )}

      {/* Single relationship buttons */}
      {!isCollection && (
        <>
          {config.showSelectButton && (
            <button 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-100 rounded hover:bg-indigo-200 transition-colors"
              onClick={() => handleClick('select')}
            >
              <Link size={16} />
              Select
            </button>
          )}
          
          {config.showUnlinkButton && entityData && (
            <button 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 rounded hover:bg-orange-200 transition-colors"
              onClick={() => handleClick('unlink')}
            >
              <Unlink size={16} />
              Unlink
            </button>
          )}
        </>
      )}

      {/* Collection relationship buttons */}
      {isCollection && !isItemLevel && (
        <>
          {config.showAddButton && (
            <button 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-100 rounded hover:bg-teal-200 transition-colors"
              onClick={() => handleClick('add')}
            >
              <Plus size={16} />
              Add
            </button>
          )}
        </>
      )}

      {isCollection && isItemLevel && config.showRemoveButton && (
        <button 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
          onClick={() => handleClick('remove')}
        >
          <Trash2 size={16} />
          Remove
        </button>
      )}

      {/* Both types */}
      {config.showCreateButton && (
        <button 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200 transition-colors"
          onClick={() => handleClick('create')}
        >
          <PlusCircle size={16} />
          Create New
        </button>
      )}
    </div>
  );
};
