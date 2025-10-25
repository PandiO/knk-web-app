import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ObjectCreator } from './components/ObjectCreator';
import { StructureOverviewPage } from './pages/StructureOverviewPage';
import { ObjectViewPage } from './pages/ObjectViewPage';
import { LandingPage } from './pages/LandingPage';
import ObjectDashboard from './components/ObjectDashboard';
import UIFieldConfigurationsPage from './pages/UIFieldConfigurationsPage';

function App() {

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        <div className="pt-16 p-8">
          <div className="max-w-7xl mx-auto space-y-12">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/create/:objectType" element={<ObjectCreator />} />
              <Route path="/view/:type/:id" element={<ObjectViewPage />} />
              <Route path="/configurations/:objectType" element={<UIFieldConfigurationsPage objectType="structure" />} />
              <Route path="/structure-overview" element={<StructureOverviewPage />} />
              <Route path="/dashboard" element={
                <>
                  <ObjectDashboard />
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