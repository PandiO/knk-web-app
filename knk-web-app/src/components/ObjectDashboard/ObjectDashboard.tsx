import { useEffect, useState } from 'react';
import { testData } from '../../data/testData';
import { DataTable } from '../DataTable';
import ObjectTypeExplorer from '../ObjectTypeExplorer';
import { StructuresManager } from '../../io/structures';
import { mapFieldDataToForm as mapStructureFieldDataToForm } from '../../utils/domain/dto/structure/StructureViewDTO';
import { mapFieldDataToForm as mapDistrictFieldDataToForm } from '../../utils/domain/dto/district/DistrictViewDTO';
// @ts-ignore: side-effect import for CSS without type declarations
import './ObjectDashboard.css';
import { TownsManager } from '../../io/towns';
import { StreetManager } from '../../io/streets';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { objectTypes: ObjectType[] };

const ObjectDashboard = ({objectTypes }: Props) => {

  const [itemsList, setItemsList] = useState<any[]>([]);

  useEffect(() => {
    console.log(`ObjectDashboard mounted`)
  }, [])

const fetchObjects = ({ type }: { type: string }) => {
    let list: any = [];
    setItemsList([]);
    switch (type) {
      case 'structure':
        StructuresManager.getInstance().getAll().then((data) => {
          setItemsList(data.map(mapStructureFieldDataToForm)); 
        }).catch((err) => { console.error(err); });
        break;
      case 'district':
        Promise.resolve(testData.districts.map(mapDistrictFieldDataToForm)).then((data) => {
          setItemsList(data);
        }).catch((err) => { console.error(err); });
        break;
      case 'town':
        TownsManager.getInstance().getAll().then((data) => {
          console.log("Fetched towns: ", data);
          setItemsList(data);
        }).catch((err) => { console.error(err); });
        break;
      case 'street':
        StreetManager.getInstance().getAll().then((data) => {
          console.log("Fetched streets: ", data);
          setItemsList(data);
        }).catch((err) => { console.error(err); });
        break;
      default:
        return Promise.resolve([]);
    }
  }

  useEffect(() => {
    const activeType = 'structure';
    fetchObjects({ type: activeType });
  }, []);

  

  // Default formatters for common fields
  const defaultFormatters = {
    Created: (value: Date) => value?.toLocaleDateString(),
    Location: (value: any) => `(${value.x}, ${value.y}, ${value.z})`,
  };

  return (
    <div className="dashboard-parent">
        <div className='dashboard-sidebar'>
            <ObjectTypeExplorer
          items={objectTypes}
          onSelect={(type) => fetchObjects({ type })}/>
        </div>
        <div className='dashboard-content'>
          {/* Towns Table */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Towns</h2>
            <DataTable
              data={itemsList}
              type='structure'
              formatters={{
                ...defaultFormatters,
                RegionName: (value) => (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {value}
                  </span>
                ),
              }}
            />
          </div>

                    {/* Towns Table */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Towns</h2>
            <DataTable
              data={itemsList}
              type='structure'
              formatters={{
                ...defaultFormatters,
                RegionName: (value) => (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {value}
                  </span>
                ),
              }}
            />
          </div>

                    {/* Towns Table */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Towns</h2>
            <DataTable
              data={itemsList}
              type='structure'
              formatters={{
                ...defaultFormatters,
                RegionName: (value) => (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {value}
                  </span>
                ),
              }}
            />
          </div>

                    {/* Towns Table */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Towns</h2>
            <DataTable
              data={itemsList}
              type='structure'
              formatters={{
                ...defaultFormatters,
                RegionName: (value) => (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {value}
                  </span>
                ),
              }}
            />
          </div>

          {/* Districts Table */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Districts</h2>
            <DataTable
              data={testData.districts.map(mapDistrictFieldDataToForm)}
              type='district'
              formatters={{
                ...defaultFormatters,
                WgRegionId: (value) => (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {value}
                  </span>
                ),
                Town: (value) => value?.Name || '-',
              }}
            />
          </div>
        </div>
    </div>
  )
}

export default ObjectDashboard;
