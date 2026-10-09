import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import ObjectTypeExplorer from '../ObjectTypeExplorer';
import type { ObjectTypeExplorerGroup } from '../ObjectTypeExplorer';
import { PagedEntityTable } from '../PagedEntityTable/PagedEntityTable';
// @ts-ignore: side-effect import for CSS without type declarations
import './ObjectDashboard.css';
import { columnDefinitionsRegistry, defaultColumnDefinitions } from '../../config/objectConfigs';
import { FeedbackModal } from '../FeedbackModal';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import { DisplayConfigurationDto } from '../../types/dtos/displayConfig/DisplayModels';
import { logging } from '../../utils';

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

const ObjectDashboard = ({ objectTypes }: Props) => {
    const navigate = useNavigate();
    const [selectedType, setSelectedType] = useState<string>('');
    const { baseMetadata, loading: metadataLoading } = useEntityMetadata();
    const hasMetadata = baseMetadata.length > 0;
    // null while loading or after a failure: the explorer then shows one flat list.
    const [displayConfiguredEntities, setDisplayConfiguredEntities] = useState<Set<string> | null>(null);
    // True once the display configurations answered (or failed), so the default selection can
    // prefer a type from the "Entities" group.
    const [displayConfigsSettled, setDisplayConfigsSettled] = useState(false);

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

    const explorerGroups = useMemo<ObjectTypeExplorerGroup[] | undefined>(() => {
        if (!displayConfiguredEntities) return undefined;
        return [
            {
                id: 'with-display-configuration',
                title: 'Entities',
                entityNames: displayConfiguredEntities,
                defaultExpanded: true,
                collapsible: false,
            },
            {
                id: 'without-display-configuration',
                title: 'Without display configuration',
                defaultExpanded: false,
                collapsible: true,
            },
        ];
    }, [displayConfiguredEntities]);

    useEffect(() => {
        // While the entity metadata loads, baseMetadata is empty: don't fall back to the built-in
        // objectTypes list then - its first entry ("location") would stick as the selection once
        // the metadata arrives (KNG-61 re-test).
        if (metadataLoading) return;
        if (hasMetadata) {
            const selectedExists = baseMetadata.some(
                metadata => metadata.entityName.toLowerCase() === selectedType.toLowerCase()
            );

            if (!selectedExists && baseMetadata[0]?.entityName) {
                // KNG-61 live test: defaulting to the API's first type (often one without a display
                // configuration) re-opened the collapsed group on every visit. Wait for the grouping
                // and start on the first type of the "Entities" group instead.
                if (!displayConfigsSettled) return;
                setSelectedType(getDefaultEntityName(baseMetadata, displayConfiguredEntities));
            }
            return;
        }

        const selectedExists = objectTypes.some(
            objectType => objectType.id.toLowerCase() === selectedType.toLowerCase()
        );
        if (!selectedExists && objectTypes[0]?.id) {
            setSelectedType(objectTypes[0].id);
        }
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
  
    const handleView = (entityTypeName: string, item: any) => {
        // Navigate to DisplayWizard for read-only view
        navigate(`/display/${entityTypeName}/${item.id}`);
    };

    // changed: navigate to FormWizardPage with entity type and ID for editing
    const handleEdit = (entityTypeName: string, item: any) => {
        // Navigate to forms page with entity type and ID
        navigate(`/forms/${entityTypeName}/edit/${item.id}`);
    };

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
            } catch (err: any) {
                const serverMessage = err?.response?.data?.message || err?.message;
                const serverCode = err?.response?.data?.code;
                setModalTitle('Delete Failed');
                setModalMessage(serverMessage || 'An error occurred while deleting.');
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
                        navigate(`/forms/category/edit/${item.id}`);
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
        <div className="dashboard-parent">
            <div className="dashboard-sidebar">
                <ObjectTypeExplorer
                    items={objectTypes}
                    entityMetadata={baseMetadata}
                    onSelect={(type) => setSelectedType(type)}
                    selectedId={selectedType}
                    groups={explorerGroups}
                    storageKey="dashboard"
                />
            </div>
            <div className="dashboard-content">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-8">
                        {baseMetadata.find(metadata => metadata.entityName.toLowerCase() === selectedType.toLowerCase())?.displayName || objectTypes.find(objectType => objectType.id.toLowerCase() === selectedType.toLowerCase())?.label || 'Items'}
                    </h2>
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
                        onSecondary={modalOnSecondary}
                        secondaryLabel={modalSecondaryLabel}
                        onClose={() => setModalOpen(false)}
                    />
                    {selectedType && (
                        <PagedEntityTable
                            entityTypeName={selectedType}
                            columns={columnDefinitionsRegistry[selectedType]?.default || defaultColumnDefinitions.default}
                            initialQuery={{ page: 1, pageSize: 10 }}
                            onRowClick={(row) => handleView(selectedType, row)}
                            refreshKey={refreshKey}
                            rowActions={[
                                (row) => (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleView(selectedType, row);
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-600"
                                        title="View"
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
