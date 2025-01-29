import { useParams } from 'react-router-dom';
import { ObjectView } from '../components/ObjectView';
import { objectConfigs } from '../config/objectConfigs';
import { mapFieldDataToForm as mapStructureFieldDataToForm, StructureViewDTO } from '../utils/domain/dto/StructureViewDTO';
import { StructuresManager } from '../io/structures';

export function ObjectViewPage() {
  const { type, id } = useParams<{ type: string; id: string }>();

  if (!type || !id) {
    return <div>Invalid parameters</div>;
  }

  const config = objectConfigs[type as keyof typeof objectConfigs];
  if (!config) {
    return <div>Invalid object type</div>;
  }

  // In a real application, you would fetch the data based on type and id
  // For now, we'll use the test data
  const getData = async (type: string, id: string, object?: any) => {
    if (object) {
      return object;
    }
    var result: any;
    switch (type) {
      case 'district':
        // DistrictManager.getInstance().getViewById(parseInt(id)).then((data) => {return mapDistrictFieldDataToForm(data)});
        break;
      case 'structure':
        StructuresManager.getInstance().getViewById(parseInt(id)).then((data) => {
          console.log("Results: ", data);
          result = data as any;
        }).catch((err) => { console.log(err)});
        break;
      case 'town':	
        // return dataManager = TownManager.getInstance();
        break;
      case 'street':
        // return dataManager = StreetManager.getInstance();
        break;
      case 'location':
        // return dataManager = LocationManager.getInstance();
        break;
      default:
        return null;
    }
    return result;
  };

  const data =  getData(type, id);
  if (!data) {
    return <div>Object not found</div>;
  }

  return <ObjectView data={data} config={config} />;
}