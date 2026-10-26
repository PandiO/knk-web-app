import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Eye, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import ObjectTypeExplorer from '../ObjectTypeExplorer';
import { PagedEntityTable } from '../PagedEntityTable/PagedEntityTable';
// @ts-ignore: side-effect import for CSS without type declarations
import './ObjectDashboard.css';
import { getColumnDefinitions } from '../../config/objectConfigs';
import { FeedbackModal } from '../FeedbackModal';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { usePageTitle } from '../../hooks/usePageTitle';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import { DisplayConfigurationDto } from '../../types/dtos/displayConfig/DisplayModels';
import { logging } from '../../utils';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { buildReturnTo, dashboardPath, displayPath, editFormPath, entityEditPath, entitySetupPath, newFormPath } from '../../utils/returnTo';
import { readLastDashboardType, writeLastDashboardType } from '../../utils/lastDashboardType';
import { readDashboardFavourites, toggleFavourite, writeDashboardFavourites } from '../../utils/dashboardFavourites';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
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
    usePageTitle('Dashboard');
    const navigate = useNavigate();
    const location = useLocation();
    // #177 link 1 (#58): the type is in the URL (/dashboard/:entityName), so Back, a refresh and a
    // form's returnTo all land on it. Bare /dashboard opens the last viewed type, else the default.
    const { entityName: routeEntityName } = useParams<{ entityName?: string }>();
    const [selectedType, setSelectedType] = useState<string>(routeEntityName ?? '');
    const { baseMetadata, loading: metadataLoading } = useEntityMetadata();
    const hasMetadata = baseMetadata.length > 0;
    // null while loading or after a failure: no type is marked and View stays enabled.
    const [displayConfiguredEntities, setDisplayConfiguredEntities] = useState<Set<string> | null>(null);
    // True once the display configurations answered (or failed), so the default selection can
    // prefer a type that has one.
    const [displayConfigsSettled, setDisplayConfigsSettled] = useState(false);
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

    // #177 link 2: one flat list; types without a published default display configuration are
    // marked, and their View (the detail page needs that configuration) is disabled.
    const withoutDisplayConfiguration = useMemo<Set<string> | null>(() => {
        if (!displayConfiguredEntities) return null;
        return new Set(
            baseMetadata
                .map(metadata => metadata.entityName.toLowerCase())
                .filter(name => !displayConfiguredEntities.has(name))
        );
    }, [baseMetadata, displayConfiguredEntities]);

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
            const selectedExists = baseMetadata.some(
                metadata => metadata.entityName.toLowerCase() === selectedType.toLowerCase()
            );

            if (selectedExists) {
                writeLastDashboardType(selectedType);
                return;
            }
            if (!baseMetadata[0]?.entityName) return;
            const lastViewed = findName(baseMetadata.map(metadata => metadata.entityName), readLastDashboardType());
            if (lastViewed) {
                selectType(lastViewed, true);
                return;
            }
            // KNG-61 live test: defaulting to the API's first type (often one without a display
            // configuration) re-opened the collapsed group on every visit. Wait for the grouping
            // and start on the first type of the "Entities" group instead.
            if (!displayConfigsSettled) return;
            selectType(getDefaultEntityName(baseMetadata, displayConfiguredEntities), true);
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
    }, [metadataLoading, hasMetadata, baseMetadata, objectTypes, selectedType, displayConfigsSettled, displayConfiguredEntities]);

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
        ? findName(baseMetadata.map(metadata => metadata.entityName), selectedType) !== null
        : findName(objectTypes.map(objectType => objectType.id), selectedType) !== null;

    // Where a form opened from here comes back to (#58): this type, with whatever the URL holds.
    const returnTo = () => buildReturnTo(location) ?? dashboardPath(selectedType);

    const handleEdit = (entityTypeName: string, item: any) => {
        // Users are edited on the player profile (#177 decision 2026-10-26).
        navigate(entityEditPath(entityTypeName, item.id, returnTo()));
    };

    // "New" opens the default form (#177 decision 3: without one the Entity setup page says so).
    const handleNew = () => {
        navigate(newFormPath(selectedType, returnTo()));
    };

    const typeLabel = baseMetadata.find(metadata => metadata.entityName.toLowerCase() === selectedType.toLowerCase())?.displayName
        || objectTypes.find(objectType => objectType.id.toLowerCase() === selectedType.toLowerCase())?.label
        || selectedType;
    const viewHint = 'No display configuration – set one up via ⚙';

    // Feedback modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalStatus, setModalStatus] = useState<'success' | 'error' | 'info'>('info');
    const [modalContinueLabel, setModalContinueLabel] = useState<string>('Continue');
    const [modalOnContinue, setModalOnContinue] = useState<(() => void) | undefined>(undefined);
    const [modalOnSecondary, setModalOnSecondary] = useState<(() => void) | undefined>(undefined);
    const [modalSecondaryLabel, setModalSecondaryLabel] = useState<string | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    const handleDelete = (entityTypeName: string, item: any) => {
        const name = item?.name || item?.label || `ID ${item?.id}`;
        setModalTitle('Confirm Deletion');
        setModalMessage(`Are you sure you want to delete ${entityTypeName} ${name}? This action cannot be undone.`);
        setModalStatus('info');
        setModalContinueLabel('Delete');

        setModalOnContinue(() => async () => {
            try {
                const { getDeleteFunctionForEntity } = await import('../../utils/entityApiMapping');
                const deleteFn = getDeleteFunctionForEntity(entityTypeName);
                await deleteFn(item.id);

                setModalTitle('Deleted');
                setModalMessage(`${entityTypeName} ${name} was deleted successfully.`);
                setModalStatus('success');
                setModalContinueLabel('Close');
                setModalOnContinue(undefined);
                setModalOnSecondary(undefined);
                setModalSecondaryLabel(undefined);
                setSelectedType((prev) => prev);
                setRefreshKey((prev) => prev + 1);
            } catch (err) {
                setModalTitle('Delete Failed');
                setModalMessage(apiRefusalReason(err) ?? 'An error occurred while deleting.');
                setModalStatus('error');

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
                // Rethrow to signal modal to stay open (FeedbackModal awaits and only closes on success)
                throw err;
            }
        });

        setModalOpen(true);
    };

    return (
        // #195: pt-6 spaces both columns from the app's top header (the page wrapper's top padding
        // is exactly the header's height), so the explorer, the title row and the table start lower.
        <div className="dashboard-parent pt-6">
            <div className="dashboard-sidebar">
                <ObjectTypeExplorer
                    items={objectTypes}
                    entityMetadata={baseMetadata}
                    onSelect={(type) => selectType(type)}
                    selectedId={selectedType}
                    storageKey="dashboard"
                    marked={withoutDisplayConfiguration ? { entityNames: withoutDisplayConfiguration, hint: viewHint } : undefined}
                    favourites={favourites}
                />
            </div>
            <div className="dashboard-content">
                <div>
                    {/* #195: title and buttons on one row, centred on each other; the row is as tall as
                        the buttons (h-9) whether they show or not, and starts level with the explorer. */}
                    <div className="mb-6 flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2" data-testid="dashboard-header">
                        <h2 className="min-w-0 break-words text-3xl font-bold leading-9 text-gray-900">
                            {typeLabel || 'Items'}
                        </h2>
                        {selectedType && selectedIsKnown && (
                            <div className="flex min-w-0 max-w-full items-center gap-2">
                                {/* On a phone a long type name is cut off rather than pushing ⚙ off-screen. */}
                                <button
                                    type="button"
                                    onClick={handleNew}
                                    className="btn-primary h-9 min-w-0 whitespace-nowrap"
                                    title={`New ${typeLabel}`}
                                >
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                    <span className="truncate">New {typeLabel}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate(entitySetupPath(selectedType))}
                                    className="btn-secondary h-9 w-9 flex-shrink-0 p-0"
                                    aria-label={`Configure ${typeLabel}`}
                                    title={`Configure ${typeLabel}: form and display configurations, default columns`}
                                >
                                    <Settings className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                    {metadataLoading && (
                        <div className="mb-4 text-sm text-gray-500">Loading entity metadata...</div>
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
                        onClose={() => setModalOpen(false)}
                    />
                    {selectedType && selectedIsKnown && (
                        <PagedEntityTable
                            entityTypeName={selectedType}
                            columns={getColumnDefinitions(selectedType)}
                            initialQuery={{ page: 1, pageSize: 10 }}
                            onRowClick={canView(selectedType) ? (row) => handleView(selectedType, row) : undefined}
                            refreshKey={refreshKey}
                            emptyState={(
                                <div className="flex flex-col items-center gap-3">
                                    <span>No {typeLabel} yet.</span>
                                    <button
                                        type="button"
                                        onClick={handleNew}
                                        className="btn-primary inline-flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        New {typeLabel}
                                    </button>
                                </div>
                            )}
                            rowActions={[
                                (row) => (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleView(selectedType, row);
                                        }}
                                        disabled={!canView(selectedType)}
                                        className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400"
                                        title={canView(selectedType) ? 'View' : viewHint}
                                        aria-label={canView(selectedType) ? 'View' : `View – ${viewHint}`}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>
                                ),
                                (row) => (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(selectedType, row);
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-600"
                                        title="Edit"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                ),
                                (row) => (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(selectedType, row);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
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
