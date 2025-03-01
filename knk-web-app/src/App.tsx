import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ObjectCreator } from './components/ObjectCreator';
import { DataTable } from './components/DataTable';
import { testData } from './data/testData';
import { StructureOverviewPage } from './pages/StructureOverviewPage';
import { StructuresManager } from './io/structures';
import { ObjectViewPage } from './pages/ObjectViewPage';
import { mapFieldDataToForm as mapStructureFieldDataToForm } from './utils/domain/dto/structure/StructureViewDTO';
import { mapFieldDataToForm as mapDistrictFieldDataToForm } from './utils/domain/dto/district/DistrictViewDTO';
import { LandingPage } from './pages/LandingPage';

function App() {
  const [itemsList, setItemsList] = useState<any[]>([]);


  useEffect(() => {
    const fetchItems = async () => {
      const items = await StructuresManager.getInstance().getAll().then((data) => {
        console.log(data);
        var list = data.map(mapStructureFieldDataToForm);
        setItemsList(list);
        console.log("Displaying: ", list);
      }).catch((err) => { console.error(err); });
    };

    fetchItems();
  }, []);

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
              <Route path="/" element={<LandingPage />} />
              <Route path="/create/:objectType" element={<ObjectCreator />} />
              <Route path="/view/:type/:id" element={<ObjectViewPage />} />
              <Route path="/structure-overview" element={<StructureOverviewPage />} />
              <Route path="/dashboard" element={
                <>
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