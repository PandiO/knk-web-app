import { useEffect, useState } from 'react';
import { testData } from '../../data/testData';
import { DataTable } from '../DataTable';
import ObjectTypeExplorer from '../ObjectTypeExplorer';
import { StructuresManager } from '../../io/structures';
import { mapFieldDataToForm as mapStructureFieldDataToForm } from '../../utils/domain/dto/structure/StructureViewDTO';
import { mapFieldDataToForm as mapDistrictFieldDataToForm } from '../../utils/domain/dto/district/DistrictViewDTO';
import './ObjectDashboard.css';

const ObjectDashboard = () => {

  const [itemsList, setItemsList] = useState<any[]>([]);

  useEffect(() => {
    console.log(`ObjectDashboard mounted`)
  }, [])



  useEffect(() => {
    const activeType = 'structure';
    const fetchItems = async () => {
      await StructuresManager.getInstance().getAll().then((data) => {
        console.log(data);
        const list = data.map(mapStructureFieldDataToForm);
        setItemsList(list);
        console.log("Displaying: ", list);
      }).catch((err) => { console.error(err); });
    };

    fetchItems();
  }, []);

  const fetchObjects = ({ type }: { type: string }) => {
    switch (type) {
      case 'structure':
        return StructuresManager.getInstance().getAll().then((data) => data.map(mapStructureFieldDataToForm));
      // Add more cases for different object types as needed
      case 'district':
        return Promise.resolve(testData.districts.map(mapDistrictFieldDataToForm));
      default:
        return Promise.resolve([]);
    }
  }

  // Default formatters for common fields
  const defaultFormatters = {
    Created: (value: Date) => value?.toLocaleDateString(),
    Location: (value: any) => `(${value.x}, ${value.y}, ${value.z})`,
  };

  return (
    <div className="dashboard-parent">
        <div className='dashboard-sidebar'>
            <ObjectTypeExplorer
              items={[{Id: 1, Name: "Towns", Type: "structure"}, {Id: 2, Name: "Districts", Type: "district"}]}
              onSelect={(type) => fetchObjects({ type })}
            />
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
