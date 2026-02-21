import React from 'react';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';

type Props = {
    metadata: EntityMetadataDto | null;
};

export const EntityMetadataNavigator: React.FC<Props> = ({ metadata }) => {
    if (!metadata) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-500">Select an entity to inspect its metadata.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900" title={metadata.displayName}>
                        {metadata.displayName}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">({metadata.entityName})</p>
                </div>
            </div>

            <div className="text-xs text-gray-500 mb-3">
                {metadata.fields.length} field{metadata.fields.length !== 1 ? 's' : ''}
            </div>

            <details className="text-xs">
                <summary className="cursor-pointer text-gray-600">Fields</summary>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                    {metadata.fields.map(field => (
                        <li key={field.fieldName} className="flex justify-between gap-3">
                            <span className="truncate" title={field.fieldName}>{field.fieldName}</span>
                            <span className="text-gray-400">{field.fieldType}</span>
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );
};
