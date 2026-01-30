import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { AccountManagementPage } from './pages/AccountManagementPage';
import ObjectDashboard from './components/ObjectDashboard';
import { objectConfigs } from './config/objectConfigs';
import { Subscription } from 'rxjs/internal/Subscription';
import { useRef } from 'react';
import { ErrorColor, logging } from './utils';
import en from './utils/languages/en-en.json';
import { ErrorView } from './components/ErrorView';
import { FormWizardPage } from './pages/FormWizardPage';
import { FormConfigBuilder } from './components/FormConfigBuilder/FormConfigBuilder';
import { FormConfigListPage } from './pages/FormConfigListPage';
import { DisplayWizardPage } from './pages/DisplayWizardPage';
import { DisplayConfigBuilder } from './components/DisplayConfigBuilder/DisplayConfigBuilder';
import { DisplayConfigListPage } from './pages/DisplayConfigListPage';
import { TownCreateWizardPage } from './pages/TownCreateWizardPage';
import React from 'react';
import { RegisterPage, RegisterSuccessPage, LoginPage } from './pages/auth';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function AppContent() {
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

  const { isLoggedIn } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {isLoggedIn && <Navigation objectTypes={objectTypes} />}
        <div className="pt-16 p-8">
          <div className="max-w-7xl mx-auto space-y-12">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/register/success" element={<RegisterSuccessPage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/account" element={
                <ProtectedRoute>
                  <AccountManagementPage />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <ObjectDashboard objectTypes={objectTypes} />
                </ProtectedRoute>
              } />
              {/* changed: Use Case 3 - Browse forms (no auto-open) */}
              <Route path="/forms" element={
                <ProtectedRoute>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} autoOpenDefaultForm={false} />
                </ProtectedRoute>
              } />
              {/* changed: Use Case 2 - Browse entity forms (no auto-open) */}
              <Route path="/forms/:entityName" element={
                <ProtectedRoute>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} autoOpenDefaultForm={false} />
                </ProtectedRoute>
              } />
              {/* changed: Use Case 1 - Edit entity (no auto-open, loads default for edit) */}
              <Route path="/forms/:entityName/edit/:entityId" element={
                <ProtectedRoute>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} autoOpenDefaultForm={false} />
                </ProtectedRoute>
              } />
              <Route path="/admin/form-configurations" element={
                <ProtectedRoute>
                  <FormConfigListPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/form-configurations/new" element={
                <ProtectedRoute>
                  <FormConfigBuilder />
                </ProtectedRoute>
              } />
              <Route path="/admin/form-configurations/edit/:id" element={
                <ProtectedRoute>
                  <FormConfigBuilder />
                </ProtectedRoute>
              } />
              {/* Town Create Wizard - Hybrid Workflow */}
              <Route path="/towns/create" element={
                <ProtectedRoute>
                  <TownCreateWizardPage />
                </ProtectedRoute>
              } />
              {/* DisplayConfiguration routes */}
              <Route path="/admin/display-configurations" element={
                <ProtectedRoute>
                  <DisplayConfigListPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/display-configurations/new" element={
                <ProtectedRoute>
                  <DisplayConfigBuilder />
                </ProtectedRoute>
              } />
              <Route path="/admin/display-configurations/edit/:id" element={
                <ProtectedRoute>
                  <DisplayConfigBuilder />
                </ProtectedRoute>
              } />
              {/* DisplayWizard routes */}
              <Route path="/display/:entityName/:id" element={
                <ProtectedRoute>
                  <DisplayWizardPage />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;