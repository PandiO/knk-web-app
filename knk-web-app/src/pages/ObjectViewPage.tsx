import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { ObjectView } from '../components/ObjectView';
import { objectConfigs } from '../config/objectConfigs';
import { getFetchByIdFunctionForEntity } from '../utils/entityApiMapping';

type ObjectViewData = any;

interface FetchState {
  data: ObjectViewData | null;
  loading: boolean;
  error: string | null;
}

export function ObjectViewPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [fetchState, setFetchState] = useState<FetchState>({
    data: null,
    loading: false,
    error: null
  });

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

    // Always fetch full data from API to ensure we have complete object details
    const fetchData = async () => {
      setFetchState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const fetchById = getFetchByIdFunctionForEntity(type);
        const data = await fetchById(id);

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
  }, [type, id]); // removed object dependency since we always fetch from API

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