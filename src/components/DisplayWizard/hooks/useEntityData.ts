// Hook to fetch entity data from backend
import { useState, useEffect, useCallback } from 'react';
import { getFetchByIdFunctionForEntity } from '../../../utils/entityApiMapping';
import { failureReason } from '../../../utils/apiRefusalReason';

export function useEntityData(entityTypeName: string, entityId: number) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * `quiet` (#183, a live update): the shown entity stays while it reloads and when the reload fails
   * (the next change or Reload tries again); no "Loading..." flash.
   */
  const fetchData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) {
        setLoading(true);
        setError(null);
      }

      const fetchById = getFetchByIdFunctionForEntity(entityTypeName);
      const entityData = await fetchById(entityId.toString());
      setData(entityData);
    } catch (err) {
      console.error('Failed to fetch entity data:', err);
      if (quiet) return;
      // Shown to the user: the API's reason, never a bare "HTTP 500: …" (KNG-169).
      setError(new Error(failureReason(err) ?? 'Failed to fetch entity data'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [entityTypeName, entityId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
