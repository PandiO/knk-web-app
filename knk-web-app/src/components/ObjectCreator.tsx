import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { objectConfigs } from '../config/objectConfigs';
import { DynamicForm } from './DynamicForm';
import { StructuresManager } from '../io/structures';
import { StructureCreateDTO, mapFormDataToFields as mapStructureFormDataToFields } from '../utils/domain/dto/StructureCreateDTO';

export function ObjectCreator() {
  const { objectType } = useParams<{ objectType: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const config = objectConfigs[objectType as keyof typeof objectConfigs];

  useEffect(() => {
    if (!config) {
      navigate('/');
      return;
    }

    // Simulate loading configuration
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [objectType, config, navigate]);

  const handleSubmit = async (data: any) => {
    try {
      switch (objectType) {
        case 'structure': {
          const structureCreateDTO: StructureCreateDTO = mapStructureFormDataToFields(data);
          console.log('saving:', structureCreateDTO);
          StructuresManager.getInstance().create(structureCreateDTO).then((result) => {
            console.log('Saved:', structureCreateDTO);
            navigate('/');
          }).catch((err) => {console.error('Error saving:', err);});
        }
        break;
      }
      // await new Promise(resolve => setTimeout(resolve, 1000));
      // console.log('Saved:', data);
      // navigate('/');
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  if (!config) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex mb-8" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          <li>
            <Link to="/" className="text-gray-500 hover:text-gray-700">
              Dashboard
            </Link>
          </li>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <li>
            <span className="text-gray-900">Create {config.label}</span>
          </li>
        </ol>
      </nav>

      <div className="bg-white shadow-sm rounded-lg">
        <DynamicForm
          config={config}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      </div>
    </div>
  );
}