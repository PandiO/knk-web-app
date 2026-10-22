import React from 'react';
import { Boxes } from 'lucide-react';
import { minecraftCatalogClient } from '../../apiClients/minecraftCatalogClient';
import { MinecraftCatalogAuditDto } from '../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { MinecraftCatalogScanCard } from '../../components/admin/minecraftCatalog/MinecraftCatalogScanCard';
import { MinecraftCatalogAuditCard } from '../../components/admin/minecraftCatalog/MinecraftCatalogAuditCard';
import { MinecraftIconOverridesCard, MinecraftMissingIconsCard } from '../../components/admin/minecraftCatalog/MinecraftMissingIconsCard';

// KNG-200 phase 3 (docs/specs/minecraft-catalog/IMPLEMENTATION_PLAN.md §5.2a, §6-§8): the
// Minecraft catalogue's admin page (knk.admin.content, see the /admin/minecraft-catalog route).
// It requests server scans and follows them, lists what the audit says needs a merge, runs the
// backfill and sets icon overrides for materials the scan found no icon for. Phase 4 lists the
// existing overrides too, so one can be changed or removed again.

export const MinecraftCatalogAdminPage: React.FC = () => {
  const [audit, setAudit] = React.useState<MinecraftCatalogAuditDto | null>(null);
  const [auditLoading, setAuditLoading] = React.useState(true);
  const [auditError, setAuditError] = React.useState<string | null>(null);

  const loadAudit = React.useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      setAudit(await minecraftCatalogClient.getAudit());
    } catch (err) {
      console.error('Failed to load the catalogue audit:', err);
      setAuditError(apiRefusalReason(err) ?? 'Could not load the catalogue audit.');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
          <h1 className="text-2xl font-bold flex items-center">
            <Boxes className="h-6 w-6 mr-2" aria-hidden="true" />
            Minecraft catalogue
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            The materials and blocks the forms pick from. A server scan brings them in line with the running
            Minecraft version; what the scan can't settle on its own is listed below.
          </p>
        </div>

        <MinecraftCatalogScanCard onScanFinished={() => void loadAudit()} />

        <MinecraftCatalogAuditCard audit={audit} loading={auditLoading} error={auditError} onReload={loadAudit} />

        {audit && <MinecraftMissingIconsCard rows={audit.missingIcons ?? []} onChanged={loadAudit} />}

        {audit && <MinecraftIconOverridesCard rows={audit.iconOverrides ?? []} onChanged={loadAudit} />}
      </div>
    </div>
  );
};

export default MinecraftCatalogAdminPage;
