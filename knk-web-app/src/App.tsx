import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ObjectCreator } from './components/ObjectCreator';
import { StructureOverviewPage } from './pages/StructureOverviewPage';
import { ObjectViewPage } from './pages/ObjectViewPage';
import { LandingPage } from './pages/LandingPage';
import ObjectDashboard from './components/ObjectDashboard';
import UIFieldConfigurationsPage from './pages/UIFieldConfigurationsPage';
import { objectConfigs } from './config/objectConfigs';
import { Subscription } from 'rxjs/internal/Subscription';
import { useRef } from 'react';
import { ErrorColor, logging } from './utils';
import en from './utils/languages/en-en.json';
import { ErrorView } from './components/ErrorView';
import { FormWizardPage } from './pages/FormWizardPage';
import { FormConfigBuilder } from './components/FormConfigBuilder/FormConfigBuilder';
import { FormConfigListPage } from './pages/FormConfigListPage';
import React from 'react';

function App() {

  var result: any[] = [];
  const errorContent = useRef(result);

  let loggingErrorHandler: Subscription | null = null;


  const removeError = (value: string) => {
    const errorContentWithRemovedItem = errorContent.current.filter(x => x.content.props.content !== value);
    setTimeout(() => {
      errorContent.current = errorContentWithRemovedItem;
      clearTimeout(0);
    }, 0);
  }

  const initialize = () => {
    loggingErrorHandler = logging.errorHandler.subscribe((data: any) => {
      const message = getMessageFromPath(String(data)) ?? String(data);
      const errorMap = errorContent.current.map(x => x.content.props.content);

      const isRed = data.includes("Red");

      if (errorMap.includes(message) === false) {
        var interval = setTimeout(() => {
          errorContent.current.shift();
          clearTimeout(interval);
        }, isRed ? 20000 : 6000);

        errorContent.current.push({
          content: <ErrorView content={message} color={isRed ? ErrorColor.Red : ErrorColor.Grey} removeCallback={() => removeError(message)} />
        });
      }
    });
  }

  function getMessageFromPath(path: string): string | undefined {
    if (!path) return undefined;
    const parts = path.split('.').filter(Boolean);
    let current: any = en;
    for (const part of parts) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return typeof current === 'string' ? current : undefined;
  }

  const objectTypes = Object.entries(objectConfigs).map(([type, config]) => ({
    id: type,
    label: config.label,
    icon: config.icon,
    createRoute: `/forms/${type}`,
  }));

  React.useEffect(() => {
    initialize();

    return () => {
      loggingErrorHandler?.unsubscribe();
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navigation objectTypes={objectTypes} />
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
                  <ObjectDashboard objectTypes={objectTypes} />
                </>
              } />
              {/* changed: Use Case 3 - Browse forms (no auto-open) */}
              <Route path="/forms" element={<FormWizardPage entityTypeName='' objectTypes={objectTypes} autoOpenDefaultForm={false} />} />
              {/* changed: Use Case 2 - Browse entity forms (no auto-open) */}
              <Route path="/forms/:entityName" element={<FormWizardPage entityTypeName='' objectTypes={objectTypes} autoOpenDefaultForm={false} />} />
              {/* changed: Use Case 1 - Edit entity (no auto-open, loads default for edit) */}
              <Route path="/forms/:entityName/edit/:entityId" element={<FormWizardPage entityTypeName='' objectTypes={objectTypes} autoOpenDefaultForm={false} />} />
              <Route path="/admin/form-configurations" element={<FormConfigListPage />} />
              <Route path="/admin/form-configurations/new" element={<FormConfigBuilder />} />
              <Route path="/admin/form-configurations/edit/:id" element={<FormConfigBuilder />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;