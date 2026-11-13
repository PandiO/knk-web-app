import { useEffect, useState } from 'react';
import { EntityMetadataDto } from '../types/dtos/metadata/MetadataModels';

/**
 * The base entity metadata this page load already has: useEntityMetadata (App.tsx loads it for staff) publishes every
 * load here. useLoadedEntityMetadata reads it without asking the API and without an AuthProvider, for small gates
 * inside widely used components (#280: a picker's "Create New" needs the related type's create nodes).
 */
let loaded: EntityMetadataDto[] = [];
const listeners = new Set<(metadata: EntityMetadataDto[]) => void>();

export function publishLoadedMetadata(metadata: EntityMetadataDto[]): void {
  loaded = metadata;
  listeners.forEach(listener => listener(metadata));
}

export function useLoadedEntityMetadata(): EntityMetadataDto[] {
  const [metadata, setMetadata] = useState<EntityMetadataDto[]>(loaded);
  useEffect(() => {
    listeners.add(setMetadata);
    setMetadata(loaded);
    return () => {
      listeners.delete(setMetadata);
    };
  }, []);
  return metadata;
}
