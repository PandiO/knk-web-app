// Hook to fetch entity data from backend
import { useState, useEffect, useCallback } from 'react';
import { getFetchByIdFunctionForEntity } from '../../../utils/entityApiMapping';

export function useEntityData(entityTypeName: string, entityId: number) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const fetchById = getFetchByIdFunctionForEntity(entityTypeName);
      const entityData = await fetchById(entityId.toString());
      setData(entityData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch entity data'));
      console.error('Failed to fetch entity data:', err);
    } finally {
      setLoading(false);
    }
  }, [entityTypeName, entityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
