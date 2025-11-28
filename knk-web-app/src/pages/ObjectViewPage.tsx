import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { ObjectView } from '../components/ObjectView';
import { objectConfigs } from '../config/objectConfigs';
import { StructureViewDTO, mapFieldDataToForm as mapStructureFieldDataToForm } from '../utils/domain/dto/structure/StructureViewDTO';
import { StructuresManager } from '../apiClients/structures';
import { DistrictViewDTO } from '../utils/domain/dto/district/DistrictViewDTO';
import { TownViewDTO } from '../utils/domain/dto/town/TownViewDTO';
import { StreetViewDTO } from '../utils/domain/dto/StreetViewDTO';
import { LocationViewDTO } from '../utils/domain/dto/location/LocationViewDTO';

type ObjectViewData = 
  | StructureViewDTO 
  | DistrictViewDTO 
  | TownViewDTO 
  | StreetViewDTO 
  | LocationViewDTO;

interface FetchState {
  data: ObjectViewData | null;
  loading: boolean;
  error: string | null;
}

export function ObjectViewPage() {
  const { type, id } = useParams<{ type: string; id: string, object?: any }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [fetchState, setFetchState] = useState<FetchState>({
    data: null,
    loading: false,
    error: null
  });
  const { object } = location.state || {};

  useEffect(() => {
    if (!type || !id) {
      setFetchState(prev => ({ ...prev, error: 'Invalid parameters' }));
      return;
    }

    const config = objectConfigs[type as keyof typeof objectConfigs];
    if (!config) {
      setFetchState(prev => ({ ...prev, error: 'Invalid object type' }));
      return;
    }

    // If we have the object from navigation state, use it directly
    if (object) {
      setFetchState({ data: object, loading: false, error: null });
      return;
    }

    const fetchData = async () => {
      setFetchState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const numericId = parseInt(id);
        let data: ObjectViewData | null = null;

        switch (type) {
          case 'structure':
            await StructuresManager.getInstance().getViewById(numericId).then((result) => {
              data = mapStructureFieldDataToForm(result);
            }).catch((err) => {setFetchState({data: null, loading: false, error: err})});
            break;
          // Add other cases as they are implemented
          default:
            throw new Error(`Data fetching not implemented for type: ${type}`);
        }

        if (!data) {
          throw new Error('No data received from API');
        }

        setFetchState({ data, loading: false, error: null });
      } catch (error) {
        setFetchState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        }));
      }
    };

    fetchData();
  }, [type, id, object]);

  const config = type ? objectConfigs[type as keyof typeof objectConfigs] : null;

  if (fetchState.error) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
        <div className="max-w-max mx-auto">
          <main className="sm:flex">
            <div className="sm:ml-6">
              <div className="sm:border-l sm:border-gray-200 sm:pl-6">
                <div className="flex items-center">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                  <h1 className="ml-3 text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
                    Error Loading Data
                  </h1>
                </div>
                <p className="mt-4 text-base text-gray-500">
                  {fetchState.error}
                </p>
              </div>
              <div className="mt-10 flex space-x-3 sm:border-l sm:border-transparent sm:pl-6">
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (fetchState.loading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Loading {config?.label || 'Data'}...
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Please wait while we fetch the latest information.
          </p>
        </div>
      </div>
    );
  }

  if (!fetchState.data) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
        <div className="max-w-max mx-auto text-center">
          <h2 className="text-lg font-medium text-gray-900">No Data Found</h2>
          <p className="mt-1 text-sm text-gray-500">
            The requested {config.label.toLowerCase()} could not be found.
          </p>
          <div className="mt-10">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ObjectView data={fetchState.data} config={config} />;
}