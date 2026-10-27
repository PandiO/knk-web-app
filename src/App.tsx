import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StaffRoute } from './components/StaffRoute';
import { LandingPage } from './pages/LandingPage';
import { AccountManagementPage } from './pages/AccountManagementPage';
import ObjectDashboard from './components/ObjectDashboard';
import { objectConfigs } from './config/objectConfigs';
import { ToastRegion } from './components/ToastRegion';
import { CloudflareSessionBanner } from './components/CloudflareSessionBanner';
import { RouteErrorBoundary } from './components/ErrorBoundary';
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
import { RoadsAdminPage } from './pages/admin/RoadsAdminPage';
import { ROAD_ADMIN_NODE } from './types/dtos/road/RoadDtos';
import { EmailLogPage } from './pages/admin/EmailLogPage';
import { InvitationsPage } from './pages/admin/InvitationsPage';
import { INVITATION_NODES } from './types/dtos/invitations/InvitationDtos';
import { EMAIL_ADMIN_NODE } from './types/dtos/email/EmailOutboxDtos';
import { MinecraftCatalogAdminPage } from './pages/admin/MinecraftCatalogAdminPage';
import { AccountTransactionsPage } from './pages/AccountTransactionsPage';
import { BalanceLogPage } from './pages/admin/BalanceLogPage';
import { TransactionDetailPage } from './pages/admin/economy/TransactionDetailPage';
import { CurrencyPolicyPage } from './pages/admin/economy/CurrencyPolicyPage';
import { CurrencyAlertsPage } from './pages/admin/economy/CurrencyAlertsPage';
import { LocationRetentionPage } from './pages/admin/locations/LocationRetentionPage';
import { LOCATION_RETENTION_NODES } from './types/dtos/locationRetention/LocationRetentionDtos';
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
import { SiegeMatchPage } from './pages/siege/SiegeMatchPage';
import React from 'react';
import { RegisterPage, LoginPage, ForgotPasswordPage, ResetPasswordPage, InvitePage, JoinPage } from './pages/auth';
import { LinkPage } from './pages/auth/LinkPage';
import { AccountLinkPage } from './pages/account/AccountLinkPage';
import { UnlinkedBanner } from './components/UnlinkedBanner';
import { NotFoundPage } from './pages/NotFoundPage';
import { CONTENT_PERMISSION_NODE, SERVER_CONFIG_PERMISSION_NODE, SIEGE_ADMIN_PERMISSION_NODE } from './hooks/useStaffAccess';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useEntityMetadata } from './hooks/useEntityMetadata';

function AppContent() {
  const objectTypes = Object.entries(objectConfigs).map(([type, config]) => ({
    id: type,
    label: config.label,
    icon: config.icon,
    createRoute: `/forms/${type}`,
  }));

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
            {/* A crash in one page shows a recoverable message instead of a blank app (X-4, KNG-141). */}
            <UnlinkedBanner />
            <RouteErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              {/* Invitation sign-up (KNG-212): the personal link drops its token from the URL on load. */}
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/join" element={<JoinPage />} />
              {/* The claim code from the server's disconnect screen, before or without login (KNG-214). */}
              <Route path="/link" element={<LinkPage />} />
              {/* Emailed GDPR deletion confirmation link; no sign-in needed (KNG-34). */}
              <Route path="/account/delete-data/confirm" element={<ConfirmDataDeletionPage />} />
              <Route path="/account" element={
                <ProtectedRoute>
                  <AccountManagementPage />
                </ProtectedRoute>
              } />
              {/* The Minecraft linking step after an invite sign-up (KNG-214). */}
              <Route path="/account/link" element={
                <ProtectedRoute>
                  <AccountLinkPage />
                </ProtectedRoute>
              } />
              <Route path="/account/transactions" element={
                <ProtectedRoute>
                  <AccountTransactionsPage />
                </ProtectedRoute>
              } />
              {/* Content tools (alpha hardening WP9.1): dashboard, forms, displays and the form/display
                  builders need knk.admin.content, which the API enforces on the writes too. */}
              <Route path="/dashboard" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <ObjectDashboard objectTypes={objectTypes} />
                </StaffRoute>
              } />
              {/* #177 link 1 (#58): the selected type in the URL; bare /dashboard reopens the last one. */}
              <Route path="/dashboard/:entityName" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <ObjectDashboard objectTypes={objectTypes} />
                </StaffRoute>
              } />
              {/* changed: Use Case 3 - Browse forms (no auto-open) */}
              <Route path="/forms" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} entityMetadataFromApp={entityMetadataWithDefaults} autoOpenDefaultForm={false} />
                </StaffRoute>
              } />
              {/* changed: Use Case 2 - Browse entity forms (no auto-open) */}
              <Route path="/forms/:entityName" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} entityMetadataFromApp={entityMetadataWithDefaults} autoOpenDefaultForm={false} />
                </StaffRoute>
              } />
              {/* changed: Use Case 1 - Edit entity (no auto-open, loads default for edit) */}
              <Route path="/forms/:entityName/edit/:entityId" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <FormWizardPage entityTypeName='' objectTypes={objectTypes} entityMetadataFromApp={entityMetadataWithDefaults} autoOpenDefaultForm={false} />
                </StaffRoute>
              } />
              {/* The builders are opened from the Entity setup page (/forms); their old list pages redirect there. */}
              <Route path="/admin/form-configurations" element={<Navigate to="/forms" replace />} />
              <Route path="/admin/form-configurations/new" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <FormConfigBuilder />
                </StaffRoute>
              } />
              <Route path="/admin/form-configurations/edit/:id" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <FormConfigBuilder />
                </StaffRoute>
              } />
              {/* DisplayConfiguration routes */}
              <Route path="/admin/display-configurations" element={<Navigate to="/forms" replace />} />
              <Route path="/admin/display-configurations/new" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <DisplayConfigBuilder />
                </StaffRoute>
              } />
              <Route path="/admin/display-configurations/edit/:id" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <DisplayConfigBuilder />
                </StaffRoute>
              } />
              {/* Game Settings and Siege settings need the node their API checks (#185):
                  knk.admin.config for every Game Settings write and the hub-domain list,
                  knk.siege.admin.manage for the siege configuration save. */}
              <Route path="/admin/game-settings" element={
                <StaffRoute node={SERVER_CONFIG_PERMISSION_NODE}>
                  <GameSettingsPage />
                </StaffRoute>
              } />
              {/* Siege Phase 3 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): global siege tunables */}
              <Route path="/admin/siege-configuration" element={
                <StaffRoute node={SIEGE_ADMIN_PERMISSION_NODE}>
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
              {/* Road navigation Phase 5 (docs/specs/navigation/IMPLEMENTATION_PLAN.md): road
                  profiles, the tile overview and the edge table - knk.admin.road, which the API
                  enforces on every write. */}
              <Route path="/admin/roads" element={
                <StaffRoute node={ROAD_ADMIN_NODE}>
                  <RoadsAdminPage />
                </StaffRoute>
              } />
              {/* Mail log (KNG-206): the outbox, a test mail and Retry - knk.admin.config, which
                  the API enforces on every call as well. */}
              {/* KNG-212: personal invites and shared codes (knk.admin.invites). */}
              <Route path="/admin/invitations" element={
                <StaffRoute node={INVITATION_NODES.manage}>
                  <InvitationsPage />
                </StaffRoute>
              } />
              <Route path="/admin/email" element={
                <StaffRoute node={EMAIL_ADMIN_NODE}>
                  <EmailLogPage />
                </StaffRoute>
              } />
              {/* Minecraft catalogue (KNG-200 phase 3, docs/specs/minecraft-catalog/IMPLEMENTATION_PLAN.md):
                  server scans, the audit, merges and icon overrides - knk.admin.content, which the
                  API enforces on every call as well. */}
              <Route path="/admin/minecraft-catalog" element={
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <MinecraftCatalogAdminPage />
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
              {/* Alpha run 1 (#174): a finished siege match, public; linked from the in-game result and /siege history. */}
              <Route path="/siege/matches/:id" element={<SiegeMatchPage />} />
              {/* KNG-80: orphaned Locations found by the weekly retention check, reviewed by hand. */}
              <Route path="/admin/locations/orphans" element={
                <StaffRoute node={LOCATION_RETENTION_NODES.view}>
                  <LocationRetentionPage />
                </StaffRoute>
              } />
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
                <StaffRoute node={CONTENT_PERMISSION_NODE}>
                  <DisplayWizardPage />
                </StaffRoute>
              } />
              {/* Anything else: a Not Found page with links home and to the account page. */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </RouteErrorBoundary>
          </div>
        </div>
        <ToastRegion />
        <CloudflareSessionBanner />
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