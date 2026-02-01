// Hook to fetch and cache display configuration
import { useState, useEffect } from 'react';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';

export function useDisplayConfig(
  entityTypeName: string,
  configurationId?: number
) {
  const [config, setConfig] = useState<DisplayConfigurationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const fetchedConfig = configurationId
          ? await displayConfigClient.getById(configurationId)
          : await displayConfigClient.getDefaultByEntityType(entityTypeName, false);
        
        setConfig(fetchedConfig);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch configuration'));
        console.error('Failed to fetch display configuration:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [entityTypeName, configurationId]);

  return { config, loading, error };
}

