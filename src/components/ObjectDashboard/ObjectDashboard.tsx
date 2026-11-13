import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Clock, Eye, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useEntityAccess, useViewableTypes } from '../../hooks/useEntityAccess';
import { CONTENT_PERMISSION_NODE, usePermission } from '../../hooks/useStaffAccess';
import { gateHint } from '../../hooks/useActionGate';
import { useConfirm } from '../../hooks/useConfirm';
import { dashboardClient } from '../../apiClients/dashboardClient';
import { BulkDeleteOutcome, countOf, runBulkDelete } from '../../utils/bulkDelete';
import { selectedIds } from '../../utils/tableExport';
import { entityDisplayLabel } from '../../utils/entityLabel';
import { toast } from '../../utils/toast';
import { BulkDeleteResultDialog } from './BulkDeleteResultDialog';
import ObjectTypeExplorer, { ObjectTypeExplorerFilter } from '../ObjectTypeExplorer';
import { PagedEntityTable } from '../PagedEntityTable/PagedEntityTable';
// @ts-ignore: side-effect import for CSS without type declarations
import './ObjectDashboard.css';
import { getColumnDefinitions } from '../../config/objectConfigs';
import { FeedbackDetails, FeedbackModal } from '../FeedbackModal';
import { refusedDeleteDetails } from '../ReferenceDetails';
import { isReferenceRefusal } from '../../utils/referenceDetails';
import { typeLabelFor } from '../../utils/entityLabel';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { DisplayConfigurationDto } from '../../types/dtos/displayConfig/DisplayModels';
import { logging } from '../../utils';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { buildReturnTo, dashboardPath, displayPath, editFormPath, entityEditPath, entitySetupPath, newFormPath, newFormWithConfigPath, resumeDraftPath } from '../../utils/returnTo';
import { readTableQuery, toSearch, writeTableQuery } from '../../utils/tableQueryParams';
import { PagedQueryDto } from '../../types/dtos/common/PagedQuery';
import { useDashboardFormOptions } from '../../hooks/useDashboardFormOptions';
import { DashboardHeaderMenu } from './DashboardHeaderMenu';
import { DashboardSelectionBar } from './DashboardSelectionBar';
import { FormSubmissionStatus } from '../../utils/enums';
import { readLastDashboardType, writeLastDashboardType } from '../../utils/lastDashboardType';
import { readDashboardFavourites, toggleFavourite, writeDashboardFavourites } from '../../utils/dashboardFavourites';
import { describeActors, useLiveEntityChanges } from '../../realtime/liveUpdates';
import { formatNumber, formatTime } from '../../utils/format';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };

/** #405: whether a row action may be used, and why not ("Requires <node>"). */
type RowActionGate = { allowed: boolean; hint: string | null };

/** A row action's accessible name: "Edit", or "Edit – Requires knk.admin.edit" while it is disabled. */
const gatedLabel = (label: string, gate: RowActionGate) => (gate.allowed || !gate.hint ? label : `${label} – ${gate.hint}`);

const ROW_ACTION_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors '
    + 'hover:bg-surface-alt focus:outline-none focus-visible:ring-2 focus-visible:ring-primary '
    + 'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted';
type Props = { objectTypes: ObjectType[] };

/** Lower-cased names of entity types that have a published (non-draft) default display configuration. */
export const getEntityNamesWithPublishedDefaultDisplay = (configs: DisplayConfigurationDto[]): Set<string> =>
    new Set(
        configs
            .filter(config => config.isDefault && !config.isDraft && config.entityTypeName)
            .map(config => config.entityTypeName.toLowerCase())
    );

/**
 * The type the dashboard opens on: the first type of the "Entities" group (published default
 * display configuration), A-Z by the label the navigator shows. Without that grouping (load failed,
 * or no type has one) the first type in API order, as before.
 */
export const getDefaultEntityName = (
    metadata: { entityName: string; displayName?: string | null }[],
    displayConfigured: Set<string> | null,
): string => {
    const primary = displayConfigured
        ? metadata.filter(meta => displayConfigured.has(meta.entityName.toLowerCase()))
        : [];
    if (primary.length === 0) return metadata[0]?.entityName ?? '';
    const label = (meta: { entityName: string; displayName?: string | null }) => meta.displayName || meta.entityName;
    return [...primary].sort((a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: 'base' }))[0].entityName;
};

/** The entry of `names` equal to `wanted` ignoring case (the route may be lower-cased), else null. */
const findName = (names: string[], wanted: string | null | undefined): string | null => {
    if (!wanted) return null;
    return names.find(name => name.toLowerCase() === wanted.toLowerCase()) ?? null;
};

const ObjectDashboard = ({ objectTypes }: Props) => {
    const navigate = useNavigate();
    const location = useLocation();
    // #177 link 1 (#58): the type is in the URL (/dashboard/:entityName), so Back, a refresh and a
    // form's returnTo all land on it. Bare /dashboard opens the last viewed type, else the default.
    const { entityName: routeEntityName } = useParams<{ entityName?: string }>();
    const [selectedType, setSelectedType] = useState<string>(routeEntityName ?? '');
    const { baseMetadata, loading: metadataLoadingOnly } = useEntityMetadata();
    const hasMetadata = baseMetadata.length > 0;
    // PandiO/knk-workspace#280 decision 8: the dashboard lists only the types whose area node the user holds
    // (`actionNodes.view`); a type of another area in the URL falls back like an unknown one.
    const { types: viewableMetadata, checking: accessChecking } = useViewableTypes(baseMetadata);
    const metadataLoading = metadataLoadingOnly || (hasMetadata && accessChecking);
    // null while loading or after a failure: no type is marked and View stays enabled.
    const [displayConfiguredEntities, setDisplayConfiguredEntities] = useState<Set<string> | null>(null);
    // True once the display configurations answered (or failed), so the default selection can
    // prefer a type that has one.
    const [displayConfigsSettled, setDisplayConfigsSettled] = useState(false);
    // #226: lower-cased names of the types with at least one form configuration (the explorer's
    // "Form configuration" filter); null while loading or after a failure (no such filter then).
    const [formConfiguredEntities, setFormConfiguredEntities] = useState<Set<string> | null>(null);
    // #194: starred types, listed first in the explorer; per browser.
    const [favouriteNames, setFavouriteNames] = useState<string[]>(readDashboardFavourites);
    const favourites = useMemo(() => ({
        entityNames: new Set(favouriteNames.map(name => name.toLowerCase())) as ReadonlySet<string>,
        onToggle: (entityName: string) => setFavouriteNames(previous => {
            const next = toggleFavourite(previous, entityName);
            writeDashboardFavourites(next);
            return next;
        }),
    }), [favouriteNames]);

    useEffect(() => {
        let cancelled = false;
        displayConfigClient.getAll(false)
            .then(configs => {
                if (!cancelled) {
                    setDisplayConfiguredEntities(getEntityNamesWithPublishedDefaultDisplay(configs ?? []));
                    setDisplayConfigsSettled(true);
                }
            })
            .catch(error => {
                if (cancelled) return;
                setDisplayConfigsSettled(true);
                console.error('Failed to load display configurations for the entity navigator', error);
                logging.errorHandler.next('ErrorMessage.DisplayConfiguration.LoadFailed');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        // An extra for the filter only: a failure just leaves the "Form configuration" filter out.
        Promise.resolve()
            .then(() => formConfigClient.getEntityNames())
            .then(names => {
                if (!cancelled) {
                    setFormConfiguredEntities(new Set((names ?? []).filter(Boolean).map(name => name.toLowerCase())));
                }
            })
            .catch(error => {
                if (!cancelled) console.error('Failed to load the entity types with a form configuration', error);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // #226: the explorer's filters. "Display configuration" follows the marker below (a published
    // default display configuration); "Form configuration" means at least one form configuration.
    const explorerFilters = useMemo<ObjectTypeExplorerFilter[]>(() => [
        { id: 'displayConfiguration', label: 'Display configuration', entityNames: displayConfiguredEntities },
        { id: 'formConfiguration', label: 'Form configuration', entityNames: formConfiguredEntities },
    ], [displayConfiguredEntities, formConfiguredEntities]);

    // #177 link 2: one flat list; types without a published default display configuration are
    // marked, and their View (the detail page needs that configuration) is disabled.
    const withoutDisplayConfiguration = useMemo<Set<string> | null>(() => {
        if (!displayConfiguredEntities) return null;
        return new Set(
            viewableMetadata
                .map(metadata => metadata.entityName.toLowerCase())
                .filter(name => !displayConfiguredEntities.has(name))
        );
    }, [viewableMetadata, displayConfiguredEntities]);

    useEffect(() => {
        setSelectedType(routeEntityName ?? '');
    }, [routeEntityName]);

    const selectType = (type: string, replace = false) => {
        setSelectedType(type);
        if (type && type !== routeEntityName) {
            navigate(dashboardPath(type), { replace });
        }
    };

    useEffect(() => {
        // While the entity metadata loads, baseMetadata is empty: don't fall back to the built-in
        // objectTypes list then - its first entry ("location") would stick as the selection once
        // the metadata arrives (KNG-61 re-test).
        if (metadataLoading) return;
        if (hasMetadata) {
            const selectedExists = viewableMetadata.some(
                metadata => metadata.entityName.toLowerCase() === selectedType.toLowerCase()
            );

            if (selectedExists) {
                writeLastDashboardType(selectedType);
                return;
            }
            if (!viewableMetadata[0]?.entityName) return;
            const lastViewed = findName(viewableMetadata.map(metadata => metadata.entityName), readLastDashboardType());
            if (lastViewed) {
                selectType(lastViewed, true);
                return;
            }
            // KNG-61 live test: defaulting to the API's first type (often one without a display
            // configuration) re-opened the collapsed group on every visit. Wait for the grouping
            // and start on the first type of the "Entities" group instead.
            if (!displayConfigsSettled) return;
            selectType(getDefaultEntityName(viewableMetadata, displayConfiguredEntities), true);
            return;
        }

        const selectedExists = objectTypes.some(
            objectType => objectType.id.toLowerCase() === selectedType.toLowerCase()
        );
        if (selectedExists) {
            writeLastDashboardType(selectedType);
            return;
        }
        if (!objectTypes[0]?.id) return;
        const lastViewed = findName(objectTypes.map(objectType => objectType.id), readLastDashboardType());
        selectType(lastViewed ?? objectTypes[0].id, true);
        // selectType only sets state and navigates; listing it would re-run this on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metadataLoading, hasMetadata, viewableMetadata, objectTypes, selectedType, displayConfigsSettled, displayConfiguredEntities]);

    // const fetchObjects = ({ type }: { type: string }) => {
    //     let list: any = [];
    //     switch (type) {
    //       case 'structure':
    //         return StructuresManager.getInstance().getAll().then((data) => {
    //           setItemsList(data.map(mapStructureFieldDataToForm)); 
    //         }).catch((err) => { console.error(err); });
    //       case 'district':
    //         return Promise.resolve(testData.districts.map(mapDistrictFieldDataToForm)).then((data) => {
    //           setItemsList(data);
    //         }).catch((err) => { console.error(err); });
    //       case 'town':
    //         return TownsManager.getInstance().getAll().then((data) => {
    //           console.log("Fetched towns: ", data);
    //           setItemsList(data);
    //         }).catch((err) => { console.error(err); });
    //       case 'street':
    //         return StreetManager.getInstance().getAll().then((data) => {
    //           console.log("Fetched streets: ", data);
    //           setItemsList(data);
    //         }).catch((err) => { console.error(err); });
    //       case 'category':
    //         return CategoryClient.getInstance().getAll().then((data) => {
    //           console.log("Fetched categories: ", data);
    //           setItemsList(data);
    //         }).catch((err) => { console.error(err); });
    //       default:
    //         return Promise.resolve([]);
    //     }
    // };
  
    const canView = (entityTypeName: string) =>
        !withoutDisplayConfiguration?.has(entityTypeName.toLowerCase());

    const handleView = (entityTypeName: string, item: any) => {
        if (!canView(entityTypeName)) return;
        // The detail page (#81) comes back here with its Back button and breadcrumb.
        navigate(displayPath(entityTypeName, item.id, returnTo()));
    };

    // A type from the URL is shown only once it's known; an unknown one is replaced by the fallback.
    const selectedIsKnown = hasMetadata
        ? !metadataLoading && findName(viewableMetadata.map(metadata => metadata.entityName), selectedType) !== null
        : findName(objectTypes.map(objectType => objectType.id), selectedType) !== null;

    // #183 (Realtime S4): another admin's save of this type refreshes the table quietly (debounced),
    // with a short "Updated by …" line; after a hub reconnect it re-reads too. Without the hub: as before.
    const [liveRefreshKey, setLiveRefreshKey] = useState(0);
    const [liveNotice, setLiveNotice] = useState<string | null>(null);
    useEffect(() => setLiveNotice(null), [selectedType]);
    useLiveEntityChanges(selectedType && selectedIsKnown ? selectedType : null, change => {
        setLiveRefreshKey(previous => previous + 1);
        if (change.reconnect && change.actors.length === 0) return;
        const time = formatTime(new Date(), { hour: '2-digit', minute: '2-digit' });
        setLiveNotice(`${describeActors(change.actors)} at ${time}`);
    });

    // Where a form opened from here comes back to (#58): this type, with whatever the URL holds
    // (page, search and sort included, #39).
    const returnTo = () => buildReturnTo(location) ?? dashboardPath(selectedType);

    // #39: the table's page, search, sort and filters live in the URL (?page=2&q=…&sort=…&dir=desc),
    // so Back, a refresh, a shared link and a form's returnTo keep the view. Picking another type
    // goes to its bare /dashboard/{type}, i.e. page 1 without a search. Changes replace the history
    // entry, so Back leaves the dashboard type instead of stepping through pages.
    const tableQuery = useMemo(() => readTableQuery(new URLSearchParams(location.search)), [location.search]);
    const handleTableQueryChange = (next: PagedQueryDto) => {
        const search = toSearch(writeTableQuery(new URLSearchParams(location.search), next));
        if (search === location.search || (search === '' && !location.search)) return;
        navigate({ pathname: location.pathname, search }, { replace: true });
    };

    // #177 follow-up: "Drafts (n)" and "New with: {config}" next to New.
    const { otherConfigs, drafts } = useDashboardFormOptions(selectedType && selectedIsKnown ? selectedType : null);

    const handleEdit = (entityTypeName: string, item: any) => {
        // Users are edited on the player profile (#177 decision 2026-10-26).
        navigate(entityEditPath(entityTypeName, item.id, returnTo()));
    };

    // "New" opens the default form (#177 decision 3: without one the Entity setup page says so).
    const handleNew = () => {
        navigate(newFormPath(selectedType, returnTo()));
    };

    const selectedMeta = useMemo(
        () => baseMetadata.find(metadata => metadata.entityName.toLowerCase() === selectedType.toLowerCase()),
        [baseMetadata, selectedType]
    );
    const typeLabel = selectedMeta?.displayName
        || objectTypes.find(objectType => objectType.id.toLowerCase() === selectedType.toLowerCase())?.label
        || selectedType;
    const viewHint = 'No display configuration – set one up via ⚙';

    // #280 decision 11: an action the user may not take is disabled with "Requires <node>" (the bulk Delete is hidden).
    const access = useEntityAccess(selectedMeta, typeLabel);
    const contentStatus = usePermission(CONTENT_PERMISSION_NODE).status;
    const setupHint = gateHint(CONTENT_PERMISSION_NODE, contentStatus);
    const canCreate = access.create.allowed;
    const createHint = access.create.checking ? null : access.create.hint;
    const [confirm, confirmModal] = useConfirm();

    // Feedback modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalStatus, setModalStatus] = useState<'success' | 'error' | 'info'>('info');
    const [modalContinueLabel, setModalContinueLabel] = useState<string>('Continue');
    const [modalOnContinue, setModalOnContinue] = useState<(() => void) | undefined>(undefined);
    const [modalOnSecondary, setModalOnSecondary] = useState<(() => void) | undefined>(undefined);
    const [modalSecondaryLabel, setModalSecondaryLabel] = useState<string | undefined>(undefined);
    // #44: a delete refused because the row is still used can list what uses it.
    const [modalDetails, setModalDetails] = useState<FeedbackDetails | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // #205: rows ticked in the checkbox column, kept across pages and searches of this type (cleared when the
    // type changes). The bar above the table exports them, or the whole search when none are ticked.
    const [selectedRows, setSelectedRows] = useState<any[]>([]);
    useEffect(() => setSelectedRows([]), [selectedType]);

    // #205 bulk delete: running, and what happened to the rows that weren't deleted.
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
    const [bulkOutcome, setBulkOutcome] = useState<BulkDeleteOutcome | null>(null);
    const [bulkLabels, setBulkLabels] = useState<Map<number, string>>(new Map());

    const showDeleteFailure = (entityTypeName: string, item: any, err: unknown) => {
        setModalTitle('Delete Failed');
        setModalMessage(apiRefusalReason(err) ?? 'An error occurred while deleting.');
        setModalStatus('error');
        setModalDetails(isReferenceRefusal(err)
            ? refusedDeleteDetails(entityTypeName, item.id, {
                typeLabel: typeLabelFor(baseMetadata),
                returnTo: returnTo(),
                onFollow: () => setModalOpen(false),
            })
            : undefined);

        const isCategory = entityTypeName.toLowerCase() === 'category';
        if (isCategory) {
            // Offer a helpful action to view children or reassign
            setModalContinueLabel('View Children');
            setModalOnContinue(() => () => {
                setModalOpen(false);
                navigate(`/display/category/${item.id}`);
            });
            setModalSecondaryLabel('Reassign Parent');
            setModalOnSecondary(() => () => {
                setModalOpen(false);
                navigate(editFormPath('category', item.id, returnTo()));
            });
        } else {
            setModalContinueLabel('Close');
            setModalOnContinue(undefined);
            setModalOnSecondary(undefined);
            setModalSecondaryLabel(undefined);
        }
        setModalOpen(true);
    };

    // #280 DESIGN § 4.7: a single delete asks with useConfirm (danger); a refusal opens the error dialog with
    // "Show what uses it" (#44).
    const handleDelete = async (entityTypeName: string, item: any) => {
        if (!access.delete.allowed) return;
        const name = entityDisplayLabel(item, item?.id);
        if (!(await confirm({
            title: `Delete ${typeLabel} "${name}"?`,
            message: "This can't be undone.",
            confirmLabel: 'Delete',
            danger: true,
        }))) return;
        try {
            const { getDeleteFunctionForEntity } = await import('../../utils/entityApiMapping');
            const deleteFn = getDeleteFunctionForEntity(entityTypeName);
            await deleteFn(item.id);
            toast.success(`${typeLabel} "${name}" was deleted.`);
            setRefreshKey((prev) => prev + 1);
            // #205: a deleted row leaves the selection.
            setSelectedRows(previous => previous.filter(row => String(row?.id) !== String(item?.id)));
        } catch (err) {
            showDeleteFailure(entityTypeName, item, err);
        }
    };

    // #205 bulk delete (#280 DESIGN § 4.7): confirm with the count and the type, then POST api/Dashboard/bulk-delete in
    // chunks of 100. Deleted rows leave the selection, refused ones stay selected and are listed with their reasons.
    const handleBulkDelete = async () => {
        const entityTypeName = selectedType;
        const rows = selectedRows;
        const ids = selectedIds(rows);
        if (ids.length === 0 || bulkProgress || !access.bulkDelete.allowed) return;
        const what = countOf(ids.length, typeLabel);
        if (!(await confirm({
            title: `Delete ${what}?`,
            message: `The ${what} you selected ${ids.length === 1 ? 'is' : 'are'} deleted one by one. `
                + "Rows that are still in use are refused and stay selected. This can't be undone.",
            confirmLabel: `Delete ${what}`,
            danger: true,
        }))) return;
        const labels = new Map<number, string>();
        rows.forEach(row => {
            const id = Number(row?.id);
            if (Number.isInteger(id)) labels.set(id, entityDisplayLabel(row, id));
        });
        setBulkLabels(labels);
        setBulkProgress({ done: 0, total: ids.length });
        try {
            const outcome = await runBulkDelete(
                ids,
                chunk => dashboardClient.bulkDelete(entityTypeName, chunk),
                (done, total) => setBulkProgress({ done, total })
            );
            const deleted = new Set(outcome.deleted.map(String));
            setSelectedRows(previous => previous.filter(row => !deleted.has(String(row?.id))));
            if (outcome.deleted.length > 0) setRefreshKey(prev => prev + 1);
            const problems = outcome.refused.length + (outcome.notRun?.ids.length ?? 0);
            if (problems === 0) {
                toast.success(`Deleted ${countOf(outcome.deleted.length, typeLabel)}.`);
            } else {
                if (outcome.deleted.length > 0) {
                    toast.warning(`Deleted ${formatNumber(outcome.deleted.length)} of ${what}; ${formatNumber(problems)} weren't deleted.`);
                } else {
                    toast.error(`No ${typeLabel} was deleted.`, {});
                }
                setBulkOutcome(outcome);
            }
        } finally {
            setBulkProgress(null);
        }
    };

    const selectedCount = selectedRows.length;
    const bulkDeleteButton = access.bulkDelete.allowed && selectedCount > 0 ? (
        <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={!!bulkProgress}
            className="btn-danger h-9 whitespace-nowrap"
            data-testid="bulk-delete"
            title={`Delete the ${countOf(selectedCount, typeLabel)} you selected`}
        >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {bulkProgress
                ? `Deleting… ${formatNumber(bulkProgress.done)} / ${formatNumber(bulkProgress.total)}`
                : `Delete (${formatNumber(selectedCount)})`}
        </button>
    ) : null;

    // #405: the row actions' gates, for the buttons in the sticky actions column.
    // #280 decision 11: disabled with "Requires <node>", not hidden. View needs a display configuration (no node).
    const viewGate: RowActionGate = { allowed: canView(selectedType), hint: canView(selectedType) ? null : viewHint };
    const editGate = access.edit;
    const deleteGate = access.delete;

    return (
        // #195: pt-6 spaces both columns from the app's top header (the page wrapper's top padding
        // is exactly the header's height), so the explorer, the title row and the table start lower.
        <div className="dashboard-parent pt-6">
            <div className="dashboard-sidebar">
                <ObjectTypeExplorer
                    items={objectTypes}
                    entityMetadata={viewableMetadata}
                    onSelect={(type) => selectType(type)}
                    selectedId={selectedType}
                    storageKey="dashboard"
                    marked={withoutDisplayConfiguration ? { entityNames: withoutDisplayConfiguration, hint: viewHint } : undefined}
                    favourites={favourites}
                    filters={explorerFilters}
                />
            </div>
            <div className="dashboard-content">
                <div>
                    {/* #195: title and buttons on one row, centred on each other; the row is as tall as
                        the buttons (h-9) whether they show or not, and starts level with the explorer. */}
                    <div className="mb-6 flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2" data-testid="dashboard-header">
                        <h2 className="min-w-0 break-words text-3xl font-bold leading-9 text-fg">
                            {typeLabel || 'Items'}
                        </h2>
                        {selectedType && selectedIsKnown && (
                            <div className="flex min-w-0 max-w-full items-center gap-2">
                                {/* On a phone a long type name is cut off rather than pushing ⚙ off-screen. */}
                                <div className="flex min-w-0 items-center">
                                    <button
                                        type="button"
                                        onClick={handleNew}
                                        disabled={!canCreate}
                                        className={`btn-primary h-9 min-w-0 whitespace-nowrap ${otherConfigs.length > 0 && canCreate ? 'rounded-r-none' : ''}`}
                                        title={canCreate ? `New ${typeLabel}` : createHint ?? undefined}
                                        aria-label={canCreate || !createHint ? undefined : `New ${typeLabel} – ${createHint}`}
                                        data-testid="dashboard-new"
                                    >
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        <span className="truncate">New {typeLabel}</span>
                                    </button>
                                    {otherConfigs.length > 0 && canCreate && (
                                        // #177 follow-up: New with a form configuration other than the default.
                                        <DashboardHeaderMenu
                                            testId="dashboard-new-with"
                                            button={<ChevronDown className="h-4 w-4" aria-hidden="true" />}
                                            buttonClassName="btn-primary h-9 w-8 rounded-l-none border-l border-white/40 p-0"
                                            buttonLabel={`New ${typeLabel} with another form`}
                                            heading="New with"
                                            items={otherConfigs.map(config => ({
                                                key: String(config.id),
                                                label: config.configurationName || `Configuration ${config.id}`,
                                                detail: config.description || undefined,
                                                onSelect: () => navigate(newFormWithConfigPath(selectedType, config.id!, returnTo())),
                                            }))}
                                        />
                                    )}
                                </div>
                                {drafts.length > 0 && (
                                    // #177 follow-up: the caller's open drafts of this type, resumed in place.
                                    <DashboardHeaderMenu
                                        testId="dashboard-drafts"
                                        button={(
                                            <>
                                                <Clock className="h-4 w-4" aria-hidden="true" />
                                                <span>Drafts ({drafts.length})</span>
                                            </>
                                        )}
                                        buttonClassName="btn-secondary h-9 whitespace-nowrap"
                                        buttonLabel={`Drafts (${drafts.length}): your saved ${typeLabel} forms`}
                                        heading="Resume a draft"
                                        items={drafts.map(draft => ({
                                            key: String(draft.id),
                                            label: draft.formConfigurationName || 'Untitled form',
                                            detail: `Step ${draft.currentStepIndex + 1} · ${draft.status === FormSubmissionStatus.Paused ? 'Paused' : 'In progress'}${
                                                draft.updatedAt ? ` · ${new Date(draft.updatedAt).toLocaleString()}` : ''}`,
                                            onSelect: () => navigate(resumeDraftPath(selectedType, draft.id!, returnTo())),
                                        }))}
                                        footer={{ label: 'All saved progress (Entity setup)', onSelect: () => navigate(entitySetupPath(selectedType)) }}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => navigate(entitySetupPath(selectedType))}
                                    // Entity setup (form and display configurations) stays knk.admin.content (#280 § 4.7).
                                    disabled={!!setupHint}
                                    className="btn-secondary h-9 w-9 flex-shrink-0 p-0"
                                    aria-label={setupHint ? `Configure ${typeLabel} – ${setupHint}` : `Configure ${typeLabel}`}
                                    title={setupHint ?? `Configure ${typeLabel}: form and display configurations, default columns`}
                                >
                                    <Settings className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                    {metadataLoading && (
                        <div className="mb-4 text-sm text-muted">Loading entity metadata...</div>
                    )}
                    {createHint && selectedType && selectedIsKnown && (
                        <p className="mb-3 text-xs text-muted" data-testid="dashboard-create-hint">New {typeLabel}: {createHint}</p>
                    )}
                    {!metadataLoading && hasMetadata && viewableMetadata.length === 0 && (
                        <div className="mb-4 rounded-md border border-line bg-surface p-4 text-sm text-muted" role="status">
                            None of the dashboard's types are in an area you can open. Ask an admin for an area permission.
                        </div>
                    )}
                    <FeedbackModal
                        open={modalOpen}
                        title={modalTitle}
                        message={modalMessage}
                        status={modalStatus}
                        continueLabel={modalContinueLabel}
                        onContinue={modalOnContinue}
                        danger={modalStatus === 'info' && modalContinueLabel === 'Delete'}
                        onSecondary={modalOnSecondary}
                        secondaryLabel={modalSecondaryLabel}
                        details={modalStatus === 'error' ? modalDetails : undefined}
                        onClose={() => setModalOpen(false)}
                    />
                    {confirmModal}
                    <BulkDeleteResultDialog
                        open={bulkOutcome !== null}
                        onClose={() => setBulkOutcome(null)}
                        entityTypeName={selectedType}
                        typeLabel={typeLabel}
                        outcome={bulkOutcome}
                        rowLabel={id => bulkLabels.get(id) ?? `${typeLabel} #${id}`}
                        referenceTypeLabel={typeLabelFor(baseMetadata)}
                        returnTo={returnTo()}
                    />
                    <p role="status" aria-live="polite" data-testid="dashboard-live-notice"
                        className={liveNotice ? 'mb-2 text-xs text-muted' : 'sr-only'}>
                        {liveNotice ?? ''}
                    </p>
                    {selectedType && selectedIsKnown && (
                        <PagedEntityTable
                            entityTypeName={selectedType}
                            columns={getColumnDefinitions(selectedType)}
                            initialQuery={{ page: 1, pageSize: 10 }}
                            query={tableQuery}
                            onQueryChange={handleTableQueryChange}
                            onRowClick={canView(selectedType) ? (row) => handleView(selectedType, row) : undefined}
                            // #39 (CRUD-4): rows are links to the detail page (middle-click, keyboard).
                            rowHref={canView(selectedType)
                                ? (row) => (row?.id != null ? displayPath(selectedType, row.id, returnTo()) : undefined)
                                : undefined}
                            refreshKey={refreshKey}
                            liveRefreshKey={liveRefreshKey}
                            // #205: a checkbox column selects rows for the bulk bar; rows stay links.
                            selectionConfig={{ mode: 'multiple' }}
                            selectionStyle="checkbox"
                            selectedItems={selectedRows}
                            onSelectionChange={setSelectedRows}
                            showSelectionBanner={false}
                            renderSelectionBar={(state) => (
                                <DashboardSelectionBar
                                    state={state}
                                    entityTypeName={selectedType}
                                    typeLabel={typeLabel}
                                    exportGate={access.export}
                                    actions={bulkDeleteButton}
                                    busy={!!bulkProgress}
                                />
                            )}
                            emptyState={(
                                <div className="flex flex-col items-center gap-3">
                                    <span>No {typeLabel} yet.</span>
                                    <button
                                        type="button"
                                        onClick={handleNew}
                                        disabled={!canCreate}
                                        title={canCreate ? undefined : createHint ?? undefined}
                                        className="btn-primary inline-flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        New {typeLabel}
                                    </button>
                                </div>
                            )}
                            // #405: compact icon buttons in the sticky actions column (title = tooltip, aria-label
                            // with the reason while disabled).
                            rowActions={[
                                (row) => (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleView(selectedType, row);
                                        }}
                                        disabled={!viewGate.allowed}
                                        className={`${ROW_ACTION_BUTTON} hover:text-fg`}
                                        title={viewGate.hint ?? 'View'}
                                        aria-label={gatedLabel('View', viewGate)}
                                    >
                                        <Eye className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                ),
                                (row) => (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(selectedType, row);
                                        }}
                                        disabled={!editGate.allowed}
                                        className={`${ROW_ACTION_BUTTON} hover:text-fg`}
                                        title={editGate.allowed || !editGate.hint ? 'Edit' : editGate.hint}
                                        aria-label={gatedLabel('Edit', editGate)}
                                    >
                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                ),
                                (row) => (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleDelete(selectedType, row);
                                        }}
                                        disabled={!deleteGate.allowed}
                                        className={`${ROW_ACTION_BUTTON} hover:text-danger`}
                                        title={deleteGate.allowed || !deleteGate.hint ? 'Delete' : deleteGate.hint}
                                        aria-label={gatedLabel('Delete', deleteGate)}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                )
                            ]}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ObjectDashboard;
