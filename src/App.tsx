import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StaffRoute } from './components/StaffRoute';
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
import { DisplayWizardPage } from './pages/DisplayWizardPage';
import { DisplayConfigBuilder } from './components/DisplayConfigBuilder/DisplayConfigBuilder';
import { GameSettingsPage } from './pages/admin/GameSettingsPage';
import { SiegeConfigurationPage } from './pages/admin/SiegeConfigurationPage';
import { PlayerProfilePage } from './pages/admin/PlayerProfilePage';
import { UserModerationPage } from './pages/admin/UserModerationPage';
import { LootboxesPage } from './pages/admin/LootboxesPage';
import { LOOTBOX_ADMIN_NODE } from './types/dtos/lootbox/LootboxDtos';
import { DiscoveryAdminPage } from './pages/admin/DiscoveryAdminPage';
import { DISCOVERY_ADMIN_NODE } from './types/dtos/discovery/DiscoveryDtos';
import { AccountTransactionsPage } from './pages/AccountTransactionsPage';
import { BalanceLogPage } from './pages/admin/BalanceLogPage';
import { TransactionDetailPage } from './pages/admin/economy/TransactionDetailPage';
import { CurrencyPolicyPage } from './pages/admin/economy/CurrencyPolicyPage';
import { CurrencyAlertsPage } from './pages/admin/economy/CurrencyAlertsPage';
import { CURRENCY_NODES } from './types/dtos/currency/CurrencyDtos';
import { LeaderboardsPage } from './pages/leaderboards/LeaderboardsPage';
import { OwnerRoute } from './components/OwnerRoute';
import { OwnerTelemetryPage } from './pages/owner/OwnerTelemetryPage';
import { OwnerPrivacyPage } from './pages/owner/OwnerPrivacyPage';
import { ConfirmDataDeletionPage } from './pages/privacy/ConfirmDataDeletionPage';
import { OwnerAnalyticsPage } from './pages/owner/OwnerAnalyticsPage';
import { OWNER_ANALYTICS_VIEW_NODE } from './types/dtos/analytics/WorldAnalyticsDtos';
import { OWNER_PRIVACY_MANAGE_NODE, OWNER_TELEMETRY_VIEW_NODE } from './types/dtos/telemetry/TelemetryDtos';
import { PublicPlayerProfilePage } from './pages/players/PublicPlayerProfilePage';
import React from 'react';
import { RegisterPage, RegisterSuccessPage, LoginPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useEntityMetadata } from './hooks/useEntityMetadata';

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
  const { baseMetadata, configurations } = useEntityMetadata();

  const entityMetadataWithDefaults = React.useMemo(() => {
    const configByEntity = new Map(
      configurations.map(cfg => [cfg.entityTypeName.toLowerCase(), cfg])
    );

    return baseMetadata.map(meta => {
      const config = configByEntity.get(meta.entityName.toLowerCase());
      return {
        ...meta,
        defaultTableColumns: config?.defaultTableColumns ?? meta.defaultTableColumns
      };
    });
  }, [baseMetadata, configurations]);

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
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              {/* Emailed GDPR deletion confirmation link; no sign-in needed (KNG-34). */}
              <Route path="/account/delete-data/confirm" element={<ConfirmDataDeletionPage />} />
              <Route path="/account" element={
                <ProtectedRoute>
                  <AccountManagementPage />
                </ProtectedRoute>
              } />
              <Route path="/account/transactions" element={
                <ProtectedRoute>
                  <AccountTransactionsPage />
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
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} entityMetadataFromApp={entityMetadataWithDefaults} autoOpenDefaultForm={false} />
                </ProtectedRoute>
              } />
              {/* changed: Use Case 2 - Browse entity forms (no auto-open) */}
              <Route path="/forms/:entityName" element={
                <ProtectedRoute>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} entityMetadataFromApp={entityMetadataWithDefaults} autoOpenDefaultForm={false} />
                </ProtectedRoute>
              } />
              {/* changed: Use Case 1 - Edit entity (no auto-open, loads default for edit) */}
              <Route path="/forms/:entityName/edit/:entityId" element={
                <ProtectedRoute>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} entityMetadataFromApp={entityMetadataWithDefaults} autoOpenDefaultForm={false} />
                </ProtectedRoute>
              } />
              {/* The builders are opened from the Forms page; their old list pages redirect there. */}
              <Route path="/admin/form-configurations" element={<Navigate to="/forms" replace />} />
              <Route path="/admin/form-configurations/new" element={
                <StaffRoute>
                  <FormConfigBuilder />
                </StaffRoute>
              } />
              <Route path="/admin/form-configurations/edit/:id" element={
                <StaffRoute>
                  <FormConfigBuilder />
                </StaffRoute>
              } />
              {/* DisplayConfiguration routes */}
              <Route path="/admin/display-configurations" element={<Navigate to="/forms" replace />} />
              <Route path="/admin/display-configurations/new" element={
                <StaffRoute>
                  <DisplayConfigBuilder />
                </StaffRoute>
              } />
              <Route path="/admin/display-configurations/edit/:id" element={
                <StaffRoute>
                  <DisplayConfigBuilder />
                </StaffRoute>
              } />
              <Route path="/admin/game-settings" element={
                <StaffRoute>
                  <GameSettingsPage />
                </StaffRoute>
              } />
              {/* Siege Phase 3 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): global siege tunables */}
              <Route path="/admin/siege-configuration" element={
                <StaffRoute>
                  <SiegeConfigurationPage />
                </StaffRoute>
              } />
              {/* Lootboxes (docs/specs/lootboxes/DESIGN.md §3.6) - knk.admin.lootbox.manage, which the
                  API enforces on every call as well. */}
              <Route path="/admin/lootboxes" element={
                <StaffRoute node={LOOTBOX_ADMIN_NODE}>
                  <LootboxesPage />
                </StaffRoute>
              } />
              {/* Domain discovery rewards and statistics (docs/specs/domain-discovery/DESIGN.md
                  §3.9) - knk.admin.discovery, which the API enforces on every call as well. */}
              <Route path="/admin/discovery" element={
                <StaffRoute node={DISCOVERY_ADMIN_NODE}>
                  <DiscoveryAdminPage />
                </StaffRoute>
              } />
              {/* Currency ledger Phase 4 (docs/specs/currency-payments/IMPLEMENTATION_PLAN.md, KNG-23):
                  the balance event log under Moderation, a transaction's detail/reversal and the
                  currency policy, each gated on its own knk.admin.currency.* node. */}
              <Route path="/admin/users/balance-log" element={
                <StaffRoute node={CURRENCY_NODES.history}>
                  <BalanceLogPage />
                </StaffRoute>
              } />
              <Route path="/admin/economy/transactions/:publicId" element={
                <StaffRoute node={CURRENCY_NODES.history}>
                  <TransactionDetailPage />
                </StaffRoute>
              } />
              <Route path="/admin/economy/policy" element={
                <StaffRoute node={CURRENCY_NODES.policy}>
                  <CurrencyPolicyPage />
                </StaffRoute>
              } />
              {/* Currency ledger Phase 5: the currency monitor's anomaly alerts and reconciliation. */}
              <Route path="/admin/economy/alerts" element={
                <StaffRoute node={CURRENCY_NODES.alerts}>
                  <CurrencyAlertsPage />
                </StaffRoute>
              } />
              {/* Player statistics (KNG-34): public pages - signed out they show only the
                  always-public fields and boards; the API filters every read for the viewer. */}
              <Route path="/leaderboards" element={<LeaderboardsPage />} />
              {/* Diagnostics and GDPR deletion (KNG-34 link 6): owner only - the API needs an exact grant. */}
              <Route path="/owner/telemetry" element={
                <OwnerRoute node={OWNER_TELEMETRY_VIEW_NODE}>
                  <OwnerTelemetryPage />
                </OwnerRoute>
              } />
              <Route path="/owner/privacy" element={
                <OwnerRoute node={OWNER_PRIVACY_MANAGE_NODE}>
                  <OwnerPrivacyPage />
                </OwnerRoute>
              } />
              {/* World analytics (KNG-34 link 7): owner only - the API needs an exact grant. */}
              <Route path="/owner/analytics" element={
                <OwnerRoute node={OWNER_ANALYTICS_VIEW_NODE}>
                  <OwnerAnalyticsPage />
                </OwnerRoute>
              } />
              <Route path="/players/:username" element={<PublicPlayerProfilePage />} />
              {/* User management Phase 1 (docs/specs/user-management/IMPLEMENTATION_PLAN.md).
                  Moderation pages are staff only (knk.admin.user.manage), see StaffRoute. */}
              <Route path="/admin/users/:id" element={
                <StaffRoute>
                  <PlayerProfilePage />
                </StaffRoute>
              } />
              {/* User management Phase 3 - moderation search/filters, and the generic-dashboard
                  entry point into PlayerProfilePage that Phase 1/2 carried forward (every row
                  here links to /admin/users/:id). */}
              <Route path="/admin/users" element={
                <StaffRoute>
                  <UserModerationPage />
                </StaffRoute>
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