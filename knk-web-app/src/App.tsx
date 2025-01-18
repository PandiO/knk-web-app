import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ObjectCreator } from './components/ObjectCreator';
import { DataTable } from './components/DataTable';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { objectConfigs } from './config/objectConfigs';
import { testData } from './data/testData';
import { ItemsManager } from './io/items';
import { StructuresManager } from './io/structures';

function App() {
  const [itemsList, setItemsList] = useState<any[]>([]);
  
  const handleView = (item: any) => {
    console.log('View item:', item);
  };

  const handleEdit = (item: any) => {
    console.log('Edit item:', item);
  };

  const handleDelete = (item: any) => {
    console.log('Delete item:', item);
  };

  useEffect(() => {
    const fetchItems = async () => {
      const items = await StructuresManager.getInstance().getAll().then((data) => {
        console.log(data);
        setItemsList(data);
      }).catch((err) => { console.error(err); });
    };

    fetchItems();
  }, []);
  const tableActions = [
    {
      label: 'View',
      onClick: handleView,
      icon: <Eye className="h-4 w-4" />,
    },
    {
      label: 'Edit',
      onClick: handleEdit,
      icon: <Pencil className="h-4 w-4" />,
    },
    {
      label: 'Delete',
      onClick: handleDelete,
      icon: <Trash2 className="h-4 w-4" />,
    },
  ];

  // Default formatters for common fields
  const defaultFormatters = {
    Created: (value: Date) => value?.toLocaleDateString(),
    Location: (value: any) => `(${value.x}, ${value.y}, ${value.z})`,
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        <div className="p-8">
          <div className="max-w-7xl mx-auto space-y-12">
            <Routes>
              <Route path="/create/:objectType" element={<ObjectCreator />} />
              <Route path="/" element={
                <>
                  {/* Towns Table */}
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-8">Towns</h2>
                    <DataTable
                      data={itemsList}
                      formatters={{
                        ...defaultFormatters,
                        RegionName: (value) => (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {value}
                          </span>
                        ),
                      }}
                      actions={tableActions}
                    />
                  </div>

                  {/* Districts Table */}
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-8">Districts</h2>
                    <DataTable
                      data={[testData.districts.northDistrict, testData.districts.southDistrict]}
                      formatters={{
                        ...defaultFormatters,
                        RegionName: (value) => (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {value}
                          </span>
                        ),
                        Town: (value) => value?.Name || '-',
                      }}
                      actions={tableActions}
                    />
                  </div>

                  {/* Structures Table */}
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-8">Structures</h2>
                    <DataTable
                      data={[
                        testData.structures.structure1,
                        testData.structures.structure2,
                        testData.structures.structure3
                      ]}
                      formatters={{
                        ...defaultFormatters,
                        RegionName: (value) => (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {value}
                          </span>
                        ),
                        District: (value) => value?.Name || '-',
                        Street: (value) => value?.Name || '-',
                        StreetNumber: (value) => `#${value}`,
                      }}
                      actions={tableActions}
                    />
                  </div>
                </>
              } />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;