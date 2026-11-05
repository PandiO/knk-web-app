import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Navigation } from './components/Navigation';
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
import { DiscoveryAdminPage } from './pages/admin/DiscoveryAdminPage';
import { RoadsAdminPage } from './pages/admin/RoadsAdminPage';
import { EmailLogPage } from './pages/admin/EmailLogPage';
import { InvitationsPage } from './pages/admin/InvitationsPage';
import { MinecraftCatalogAdminPage } from './pages/admin/MinecraftCatalogAdminPage';
import { AccountTransactionsPage } from './pages/AccountTransactionsPage';
import { BalanceLogPage } from './pages/admin/BalanceLogPage';
import { TransactionDetailPage } from './pages/admin/economy/TransactionDetailPage';
import { CurrencyPolicyPage } from './pages/admin/economy/CurrencyPolicyPage';
import { CurrencyAlertsPage } from './pages/admin/economy/CurrencyAlertsPage';
import { LocationRetentionPage } from './pages/admin/locations/LocationRetentionPage';
import { LeaderboardsPage } from './pages/leaderboards/LeaderboardsPage';
import { OwnerTelemetryPage } from './pages/owner/OwnerTelemetryPage';
import { OwnerPrivacyPage } from './pages/owner/OwnerPrivacyPage';
import { ConfirmDataDeletionPage } from './pages/privacy/ConfirmDataDeletionPage';
import { OwnerAnalyticsPage } from './pages/owner/OwnerAnalyticsPage';
import { PublicPlayerProfilePage } from './pages/players/PublicPlayerProfilePage';
import { SiegeMatchPage } from './pages/siege/SiegeMatchPage';
import { GuidesPage } from './pages/guides/GuidesPage';
import { EnchantmentGuidePage } from './pages/guides/EnchantmentGuidePage';
import React from 'react';
import { RegisterPage, LoginPage, ForgotPasswordPage, ResetPasswordPage, InvitePage, JoinPage } from './pages/auth';
import { LinkPage } from './pages/auth/LinkPage';
import { AccountLinkPage } from './pages/account/AccountLinkPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RealtimeProvider } from './realtime/RealtimeProvider';
import { useEntityMetadata } from './hooks/useEntityMetadata';
import { ThemeSwitcher } from './theme/ThemeSwitcher';
import { themePickerVisible } from './theme/themes';
import { PageBackground } from './theme/PageBackgroundLayer';
import { AppRoutes, RouteElements } from './routes/AppRoutes';
import { AdminHomePage } from './pages/admin/AdminHomePage';

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

  const forms = <FormWizardPage entityTypeName='' objectTypes={objectTypes} entityMetadataFromApp={entityMetadataWithDefaults} autoOpenDefaultForm={false} />;
  // The page of every route-meta entry; access, layout, title and breadcrumbs are in the table.
  const elements: RouteElements = {
    home: <LandingPage />,
    register: <RegisterPage />,
    login: <LoginPage />,
    forgotPassword: <ForgotPasswordPage />,
    resetPassword: <ResetPasswordPage />,
    inviteToken: <InvitePage />,
    invite: <InvitePage />,
    join: <JoinPage />,
    link: <LinkPage />,
    confirmDataDeletion: <ConfirmDataDeletionPage />,
    leaderboards: <LeaderboardsPage />,
    publicPlayer: <PublicPlayerProfilePage />,
    siegeMatch: <SiegeMatchPage />,
    guides: <GuidesPage />,
    enchantmentGuide: <EnchantmentGuidePage />,
    account: <AccountManagementPage />,
    accountLink: <AccountLinkPage />,
    accountTransactions: <AccountTransactionsPage />,
    adminHome: <AdminHomePage />,
    dashboard: <ObjectDashboard objectTypes={objectTypes} />,
    dashboardType: <ObjectDashboard objectTypes={objectTypes} />,
    // Entity setup (#177 decision 4): browse forms (no auto-open), per type, and edit an entity.
    entitySetup: forms,
    entitySetupType: forms,
    entityEdit: forms,
    formBuilderNew: <FormConfigBuilder />,
    formBuilderEdit: <FormConfigBuilder />,
    displayBuilderNew: <DisplayConfigBuilder />,
    displayBuilderEdit: <DisplayConfigBuilder />,
    entityDetail: <DisplayWizardPage />,
    minecraftCatalog: <MinecraftCatalogAdminPage />,
    lootboxes: <LootboxesPage />,
    discovery: <DiscoveryAdminPage />,
    roads: <RoadsAdminPage />,
    orphanedLocations: <LocationRetentionPage />,
    moderation: <UserModerationPage />,
    playerProfile: <PlayerProfilePage />,
    invitations: <InvitationsPage />,
    balanceLog: <BalanceLogPage />,
    transaction: <TransactionDetailPage />,
    currencyPolicy: <CurrencyPolicyPage />,
    currencyAlerts: <CurrencyAlertsPage />,
    gameSettings: <GameSettingsPage />,
    siegeSettings: <SiegeConfigurationPage />,
    mailLog: <EmailLogPage />,
    diagnostics: <OwnerTelemetryPage />,
    dataDeletion: <OwnerPrivacyPage />,
    worldAnalytics: <OwnerAnalyticsPage />,
    notFound: <NotFoundPage />,
  };

  return (
    <>
      {/* #231: image 1 behind every page when the page background is on; `page-canvas` is the translucent
          page backdrop over it (src/theme/pageBackground.css). On by default; off renders nothing. */}
      <PageBackground />
      <div className="page-canvas min-h-screen bg-gray-100">
        {isLoggedIn && <Navigation objectTypes={objectTypes} />}
        {/* Logged out there is no navigation bar: the theme switcher floats in the top-right corner (#95). */}
        {!isLoggedIn && themePickerVisible() && (
          <div className="fixed right-4 top-4 z-[60]">
            <ThemeSwitcher variant="floating" />
          </div>
        )}
        {/* PandiO/knk-workspace#30: the routes come from the route-meta table (src/routes/routeTable.ts), each in
            its layout (public, player, admin: page frame, title, sidebar, breadcrumbs, its own error boundary).
            This boundary only catches a crash of a layout itself. */}
        <RouteErrorBoundary>
          <AppRoutes elements={elements} />
        </RouteErrorBoundary>
        <ToastRegion />
        <CloudflareSessionBanner />
      </div>
    </>
  );
}

// A data router (one catch-all route around the <Routes> of AppContent) instead of <BrowserRouter>:
// the form wizard's unsaved-changes guard needs useBlocker, which only works inside one (#109).
function App() {
  const [router] = React.useState(() => createBrowserRouter([{ path: '*', element: <AppContent /> }]));
  return (
    <AuthProvider>
      {/* PandiO/knk-workspace#181: the web hub (world tasks live); components poll while it is down. */}
      <RealtimeProvider>
        <RouterProvider router={router} />
      </RealtimeProvider>
    </AuthProvider>
  );
}

export default App;