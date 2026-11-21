// DisplayWizardPage - Page component for displaying entities
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import DisplayWizard from '../components/DisplayWizard/DisplayWizard';
import { EntityDetailHeader } from '../components/DisplayWizard/EntityDetailHeader';
import { DisplayAction } from '../types/dtos/displayConfig/DisplayModels';
import { usePageTitle } from '../hooks/usePageTitle';
import { useEntityMetadata } from '../hooks/useEntityMetadata';
import { useConfirm } from '../hooks/useConfirm';
import { buildReturnTo, dashboardPath, displayPath, editOpensFormWizard, entityEditPath, newFormPath, readReturnTo } from '../utils/returnTo';
import { detailTrail } from '../utils/breadcrumbs';
import { entityDisplayLabel, typeLabelFor } from '../utils/entityLabel';
import { getDeleteFunctionForEntity } from '../utils/entityApiMapping';
import { apiRefusalReason } from '../utils/apiRefusalReason';
import { toast } from '../utils/toast';
import { describeActors, useLiveEntityChanges } from '../realtime/liveUpdates';
import { formatTime } from '../utils/format';
import { useAllNodesGate } from '../hooks/useActionGate';
import { withContentNode } from '../hooks/useEntityAccess';
import { FeedbackModal } from '../components/FeedbackModal';
import { refusedDeleteDetails } from '../components/ReferenceDetails';
import { isReferenceRefusal } from '../utils/referenceDetails';
import { GroupPermissionsPanel } from '../components/admin/permissionGroups/GroupPermissionsPanel';
import { DomainLandmarksPanel, showsDomainLandmarks } from '../components/landmarks/DomainLandmarksPanel';
import { TownTerritoryPanel } from '../components/territory/TownTerritoryPanel';
import { TerritoryConflictPanel } from '../components/territory/TerritoryConflictPanel';
import { StructureTerritoryPanel } from '../components/territory/StructureTerritoryPanel';
import { StoragePanel } from '../components/stock/StoragePanel';
import { StockTransactionPanel } from '../components/stock/StockTransactionPanel';
import { StructurePlacementPanel } from '../components/production/StructurePlacementPanel';
import { StructureStoragesPanel } from '../components/production/StructureStoragesPanel';
import { isProductionWorldType } from '../utils/productionWorld';
import { StructureProductionPanel } from '../components/production/StructureProductionPanel';
import { ProductionKindLevelsPanel } from '../components/production/ProductionKindLevelsPanel';
import { ProductionKindLevelItemsPanel } from '../components/production/ProductionKindLevelItemsPanel';
import { ProductionLinePanel } from '../components/production/ProductionLinePanel';
import { ClimateZonePanel } from '../components/production/ClimateZonePanel';
import { WeatherTypeEffectsPanel } from '../components/production/WeatherTypeEffectsPanel';
import { StructureYieldPanel } from '../components/production/StructureYieldPanel';
import { ProductionAreaPanel } from '../components/production/ProductionAreaPanel';
import { AreaSurveyPanel } from '../components/production/AreaSurveyPanel';
import { ProductionKindYieldTablePanel } from '../components/production/ProductionKindYieldTablePanel';
import { StructureTransportPanel } from '../components/transport/StructureTransportPanel';
import { TransportOrderPanel } from '../components/transport/TransportOrderPanel';
import { TownLogisticsPanel } from '../components/logistics/TownLogisticsPanel';
import { WarehouseLogisticsPanel } from '../components/logistics/WarehouseLogisticsPanel';
import { StructureLogisticsPanel } from '../components/logistics/StructureLogisticsPanel';
import { LogisticsPolicyPanel } from '../components/logistics/LogisticsPolicyPanel';
import { LogisticsPlannerRunPanel } from '../components/logistics/LogisticsPlannerRunPanel';
import { LogisticsReservationPanel } from '../components/logistics/LogisticsReservationPanel';
import { ShopTypePanel } from '../components/shops/ShopTypePanel';
import { ShopPanel } from '../components/shops/ShopPanel';
import { TownAccountPanel } from '../components/shops/TownAccountPanel';
import { TownAccountSummary } from '../components/shops/TownAccountSummary';

/** Tells the page the entity's label once the wizard loaded it (for the tab title). */
const LabelReporter: React.FC<{ label: string; onLabel: (label: string) => void }> = ({ label, onLabel }) => {
  useEffect(() => {
    onLabel(label);
  }, [label, onLabel]);
  return null;
};

export const DisplayWizardPage: React.FC = () => {
  const { entityName, id } = useParams<{ entityName: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { baseMetadata } = useEntityMetadata();
  const [confirm, confirmModal] = useConfirm();
  const [entityLabel, setEntityLabel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // #44: a delete refused because the record is still used opens a dialog that can list what uses it.
  const [inUse, setInUse] = useState<{ title: string; message: string } | null>(null);
  // #183 (Realtime S4): another admin's change to this entity re-reads it quietly, with a short
  // "Updated by …" line; a delete says so instead (the page stays, with a way back).
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [liveNotice, setLiveNotice] = useState<{ text: string; deleted: boolean } | null>(null);
  const numericId = id != null && /^\d+$/.test(id) ? Number(id) : null;
  useEffect(() => setLiveNotice(null), [entityName, id]);

  const labelFor = useMemo(() => typeLabelFor(baseMetadata), [baseMetadata]);
  // #188 / #280: Edit and Delete of this record need the type's action nodes (Delete: area node + knk.admin.delete).
  const typeMeta = useMemo(
    () => baseMetadata?.find(meta => meta.entityName.toLowerCase() === (entityName ?? '').toLowerCase()),
    [baseMetadata, entityName]
  );
  // #371: Edit opens the form wizard, which needs knk.admin.content on top of the type's edit nodes (a user's Edit opens
  // the player profile instead).
  const editNodes = useMemo(
    () => (editOpensFormWizard(entityName) ? withContentNode(typeMeta?.actionNodes?.edit) : typeMeta?.actionNodes?.edit),
    [entityName, typeMeta]
  );
  const editGate = useAllNodesGate(editNodes);
  const deleteGate = useAllNodesGate(typeMeta?.actionNodes?.delete);
  const typeLabel = entityName ? labelFor(entityName) : '';
  useLiveEntityChanges(entityName && numericId != null ? entityName : null, change => {
    if (change.deleted) {
      setLiveNotice({ text: describeActors(change.actors, `This ${typeLabel || 'item'} was deleted`), deleted: true });
      return;
    }
    setLiveRefreshKey(previous => previous + 1);
    if (change.reconnect && change.actors.length === 0) return;
    const time = formatTime(new Date(), { hour: '2-digit', minute: '2-digit' });
    setLiveNotice(previous => previous?.deleted ? previous : { text: `${describeActors(change.actors)} at ${time}`, deleted: false });
  }, { id: numericId });
  // #81: an entity-specific tab title ("Cinix · Town"), generic until the entity loaded.
  usePageTitle(entityLabel ? `${entityLabel} · ${typeLabel}` : 'Details');

  // Back goes where the page was opened from (the dashboard type), else the dashboard on this type.
  const returnTo = readReturnTo(searchParams);
  const backTarget = returnTo ?? dashboardPath(entityName);
  // A form or another detail page opened from here comes back to this page (with its own returnTo).
  const here = buildReturnTo(location);

  const handleActionClick = (action: DisplayAction) => {
    switch (action.type) {
      case 'edit':
        if (action.entityId != null) navigate(entityEditPath(action.entityType, action.entityId, here));
        break;
      case 'view':
        if (action.entityId != null) navigate(displayPath(action.entityType, action.entityId, here));
        break;
      case 'create':
        navigate(newFormPath(action.entityType, here));
        break;
      // select / unlink / add / remove / delete are handled by the wizard itself (#188).
      default:
        break;
    }
  };

  if (!entityName || !id) {
    return (
      <div className="page-container">
        <div className="error-message">Invalid parameters</div>
      </div>
    );
  }

  const handleDelete = async (label: string) => {
    const confirmed = await confirm({
      title: `Delete ${typeLabel} "${label}"?`,
      message: `${typeLabel} "${label}" is deleted. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await getDeleteFunctionForEntity(entityName)(id);
      toast.success(`${typeLabel} "${label}" deleted.`);
      navigate(backTarget);
    } catch (error) {
      const reason = apiRefusalReason(error) ?? `${typeLabel} "${label}" could not be deleted.`;
      if (isReferenceRefusal(error)) {
        setInUse({ title: `${typeLabel} "${label}" is still in use`, message: reason });
      } else {
        toast.error(reason);
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderHeader = (entity: Record<string, unknown>) => {
    const label = entityDisplayLabel(entity, id);
    return (
      <>
        <LabelReporter label={label} onLabel={setEntityLabel} />
        <EntityDetailHeader
          title={label}
          typeLabel={typeLabel}
          trail={detailTrail({ returnTo, entityTypeName: entityName, entityLabel: label, labelFor })}
          onBack={() => navigate(backTarget)}
          onEdit={() => navigate(entityEditPath(entityName, id, here))}
          onDelete={() => handleDelete(label)}
          deleting={deleting}
          checking={editGate.checking || deleteGate.checking}
          editBlocked={editGate.allowed || editGate.checking ? null : editGate.hint}
          deleteBlocked={typeMeta?.deletable === false
            ? `${typeLabel} records can't be deleted.`
            : deleteGate.allowed || deleteGate.checking ? null : deleteGate.hint}
        />
      </>
    );
  };

  return (
    <div className="page-container">
      {liveNotice?.deleted ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong">
          <span>{liveNotice.text}.</span>
          <button type="button" className="btn-secondary text-sm" onClick={() => navigate(backTarget)}>Back</button>
        </div>
      ) : (
        <p role="status" aria-live="polite" data-testid="detail-live-notice"
          className={liveNotice ? 'mb-2 text-xs text-muted' : 'sr-only'}>
          {liveNotice?.text ?? ''}
        </p>
      )}
      <DisplayWizard
        entityTypeName={entityName}
        entityId={parseInt(id)}
        onActionClick={handleActionClick}
        renderHeader={renderHeader}
        liveRefreshKey={liveRefreshKey}
      />
      {/* PandiO/knk-workspace#50: a permission group's own grants and their history, below the group's details. */}
      {entityName.toLowerCase() === 'permissiongroup' && numericId != null && (
        <GroupPermissionsPanel groupId={numericId} groupName={entityLabel ?? `Group #${numericId}`} />
      )}
      {/* Off-road navigation phase 5.1 (PandiO/knk-workspace#708): the landmarks linked to a domain. */}
      {showsDomainLandmarks(entityName) && numericId != null && (
        <DomainLandmarksPanel domainId={numericId} domainName={entityLabel ?? `${typeLabel} #${numericId}`} returnTo={here} />
      )}
      {/* Territory V1 (PandiO/knk-workspace#690): a town's power and ranges, a conflict's resolution, a structure's
          flag and loyalty. A save re-reads the details above. */}
      {entityName.toLowerCase() === 'town' && numericId != null && (
        <TownTerritoryPanel townId={numericId} townName={entityLabel ?? `Town #${numericId}`} returnTo={here}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'territoryconflict' && numericId != null && (
        <TerritoryConflictPanel conflictId={numericId} returnTo={here} onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'structure' && numericId != null && (
        <StructureTerritoryPanel structureId={numericId} returnTo={here} />
      )}
      {/* Stock core P1 (PandiO/knk-workspace#675): a storage's capacity, lock, lines and unique items with the adjust and
          move dialogs; a ledger transaction's moves and Reverse. Stock that moved re-reads the details above. */}
      {entityName.toLowerCase() === 'storage' && numericId != null && (
        <StoragePanel storageId={numericId} returnTo={here} onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'stocktransaction' && numericId != null && (
        <StockTransactionPanel transactionId={numericId} returnTo={here} onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {/* P2 world (PandiO/knk-workspace#676): a warehouse's or production structure's placement (district or rural) and
          warnings, its territory flag and loyalty (A07, the structure territory panel) and its storages with their stock. */}
      {isProductionWorldType(entityName) && numericId != null && (
        <>
          <StructurePlacementPanel entityTypeName={entityName} structureId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
          <StructureTerritoryPanel structureId={numericId} returnTo={here} />
          <StructureStoragesPanel structureId={numericId} structureName={entityLabel ?? `${typeLabel} #${numericId}`} returnTo={here}
            onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
        </>
      )}
      {/* Production engine P3 (PandiO/knk-workspace#678): a production structure's production (why not producing, line
          rates, workers, upgrade, cycle trace), a kind's levels, a level's items, a line's inputs and cycles, a climate
          zone's odds, towns and rolls, a weather type's effects. A save re-reads the details above. */}
      {entityName.toLowerCase() === 'productionstructure' && numericId != null && (
        <StructureProductionPanel structureId={numericId} returnTo={here} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'productionkind' && numericId != null && (
        <ProductionKindLevelsPanel kindId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {entityName.toLowerCase() === 'productionkindlevel' && numericId != null && (
        <ProductionKindLevelItemsPanel levelId={numericId} onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'productionline' && numericId != null && (
        <ProductionLinePanel lineId={numericId} returnTo={here} onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'climatezone' && numericId != null && (
        <ClimateZonePanel zoneId={numericId} returnTo={here} onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'weathertype' && numericId != null && (
        <WeatherTypeEffectsPanel weatherTypeId={numericId} onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {/* Yield areas P4 (PandiO/knk-workspace#680): a production structure's yield (source, areas, Survey now, why each
          rate is what it is, Hybrid overrides), an area's plot, composition, trend and history, a survey's composition,
          and a kind's yield table and primary outputs. */}
      {entityName.toLowerCase() === 'productionstructure' && numericId != null && (
        <StructureYieldPanel structureId={numericId} returnTo={here} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'productionarea' && numericId != null && (
        <ProductionAreaPanel areaId={numericId} returnTo={here} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'areasurvey' && numericId != null && (
        <AreaSurveyPanel surveyId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {entityName.toLowerCase() === 'productionkind' && numericId != null && (
        <ProductionKindYieldTablePanel kindId={numericId} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {/* Transport core P5 (PandiO/knk-workspace#682): a production structure's transport (warnings, the automatic
          trigger's dry run, open orders, lanes) and an order's status, cargo, route and timeline with Cancel. */}
      {entityName.toLowerCase() === 'productionstructure' && numericId != null && (
        <StructureTransportPanel structureId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {entityName.toLowerCase() === 'transportorder' && numericId != null && (
        <TransportOrderPanel orderId={numericId} returnTo={here} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {/* Town logistics P9 (PandiO/knk-workspace#686): a town's supply, reservations, planner dry run and service areas;
          a warehouse's service area and local policy; a consumer's min/max settings; a policy's rule editor and versions;
          a planner run's explanation; a reservation with Release. Staff with the World area's node only. */}
      {entityName.toLowerCase() === 'town' && numericId != null && (
        <TownLogisticsPanel townId={numericId} townName={entityLabel ?? `Town #${numericId}`} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {/* Shops P10 (PandiO/knk-workspace#938): the town's account (coins, a link to its ledger). World area only. */}
      {entityName.toLowerCase() === 'town' && numericId != null && (
        <TownAccountSummary townId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {entityName.toLowerCase() === 'warehouse' && numericId != null && (
        <WarehouseLogisticsPanel warehouseId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {entityName.toLowerCase() === 'productionstructure' && numericId != null && (
        <StructureLogisticsPanel structureId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {entityName.toLowerCase() === 'logisticspolicy' && numericId != null && (
        <LogisticsPolicyPanel policyId={numericId} returnTo={here} pageReturnTo={returnTo} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'logisticsplannerrun' && numericId != null && (
        <LogisticsPlannerRunPanel runId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {entityName.toLowerCase() === 'logisticsreservation' && numericId != null && (
        <LogisticsReservationPanel reservationId={numericId} returnTo={here} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {/* Shops P10 (PandiO/knk-workspace#688): a shop type's accepted categories and levels; a shop's summary, town account,
          offer, catalogue, sales and hourly trade stats, then its processing view and restocking (a shop is a production
          structure underneath); a town account's balance and ledger. Staff with the World area's node only. */}
      {entityName.toLowerCase() === 'shoptype' && numericId != null && (
        <ShopTypePanel shopTypeId={numericId} returnTo={here} refreshKey={liveRefreshKey}
          onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
      )}
      {entityName.toLowerCase() === 'shop' && numericId != null && (
        <>
          <ShopPanel shopId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
          <StructureProductionPanel structureId={numericId} returnTo={here} refreshKey={liveRefreshKey}
            onChanged={() => setLiveRefreshKey(previous => previous + 1)} />
          <StructureLogisticsPanel structureId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
        </>
      )}
      {entityName.toLowerCase() === 'townaccount' && numericId != null && (
        <TownAccountPanel accountId={numericId} returnTo={here} refreshKey={liveRefreshKey} />
      )}
      {confirmModal}
      <FeedbackModal
        open={inUse !== null}
        title={inUse?.title ?? ''}
        message={inUse?.message ?? ''}
        status="error"
        onClose={() => setInUse(null)}
        details={inUse ? refusedDeleteDetails(entityName, id, {
          typeLabel: labelFor,
          returnTo: here,
          onFollow: () => setInUse(null),
        }) : undefined}
      />
    </div>
  );
};

export default DisplayWizardPage;
