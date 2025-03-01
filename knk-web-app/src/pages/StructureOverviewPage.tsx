import React, { useEffect, useState } from 'react';
import { Building2, MapPin, Home, Hash } from 'lucide-react';
import { StructuresManager } from '../io/structures';
import { StructureOverviewDTO } from '../utils/domain/dto/structure/StructureOverviewDTO';
import { FilterType, StructureOverviewFilter } from '../utils/enums';
import { useNavigate } from 'react-router-dom';
import { mapFieldDataToForm as mapStructureFieldDataToForm } from '../utils/domain/dto/structure/StructureOverviewDTO';

export function StructureOverviewPage() {
  const [structures, setStructures] = useState<StructureOverviewDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStructures = async () => {
      try {
        const parameters = {
          filters: new Map<StructureOverviewFilter, number[]>(),
          filterType: FilterType.Include
        };
        
        const data = await StructuresManager.getInstance().getOverview(parameters);
        setStructures(data.map(mapStructureFieldDataToForm));
      } catch (err) {
        setError('Failed to load structures');
        console.error('Error fetching structures:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStructures();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Structure Overview</h1>
        <p className="mt-2 text-sm text-gray-500">
          A comprehensive view of all structures in the system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {structures.map((structure) => (
          <div
            key={structure.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/view/structure/${structure.id}`)}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <Building2 className="h-6 w-6 text-primary" />
                  <h2 className="ml-2 text-xl font-semibold text-gray-900">
                    {structure.name}
                  </h2>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  #{structure.id}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {structure.streetName && (
                  <div className="flex items-center text-sm">
                    <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">
                      {structure.streetName}
                      {structure.streetNumber && ` #${structure.streetNumber}`}
                    </span>
                  </div>
                )}

                {structure.districtName && (
                  <div className="flex items-center text-sm">
                    <Hash className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">{structure.districtName}</span>
                  </div>
                )}

                {structure.townName && (
                  <div className="flex items-center text-sm">
                    <Home className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">{structure.townName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {structures.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No structures</h3>
          <p className="mt-1 text-sm text-gray-500">
            No structures are available in the overview.
          </p>
        </div>
      )}
    </div>
  );
}