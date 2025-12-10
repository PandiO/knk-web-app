// Hook to fetch entity data from backend
import { useState, useEffect } from 'react';
import { appConfig } from '../../../config/appConfig';

const API_BASE_URL = appConfig.api.baseUrl;

export function useEntityData(entityTypeName: string, entityId: number) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Construct endpoint: /api/{entityTypeName}s/{id}
        // Note: backend controllers are typically plural (Towns, Districts, etc.)
        const entityNamePlural = entityTypeName.toLowerCase() + 's';
        const response = await fetch(`${API_BASE_URL}/${entityNamePlural}/${entityId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${entityTypeName} with ID ${entityId}`);
        }

        const entityData = await response.json();
        setData(entityData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch entity data'));
        console.error('Failed to fetch entity data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [entityTypeName, entityId]);

  return { data, loading, error };
}
