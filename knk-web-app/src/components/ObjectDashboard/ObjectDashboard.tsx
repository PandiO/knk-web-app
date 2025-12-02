import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import ObjectTypeExplorer from '../ObjectTypeExplorer';
import { PagedEntityTable } from '../PagedEntityTable/PagedEntityTable';
// @ts-ignore: side-effect import for CSS without type declarations
import './ObjectDashboard.css';
import { StructuresManager } from '../../apiClients/structures';
import { columnDefinitionsRegistry, defaultColumnDefinitions } from '../../config/objectConfigs';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { objectTypes: ObjectType[] };

const ObjectDashboard = ({ objectTypes }: Props) => {
    const navigate = useNavigate();
    const [selectedType, setSelectedType] = useState<string>('structure');

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
  
    useEffect(() => {
        const activeType = 'structure';
        // fetchObjects({ type: activeType });
    }, []);

    const handleView = (entityTypeName: string, item: any) => {
        navigate(`/view/${entityTypeName}/${item.id}`, { state: { object: item } });
    };

    // changed: navigate to FormWizardPage with entity type and ID for editing
    const handleEdit = (entityTypeName: string, item: any) => {
        // Navigate to forms page with entity type and ID
        navigate(`/forms/${entityTypeName}/edit/${item.id}`);
    };

    const handleDelete = (entityTypeName: string, item: any) => {
        console.log('Delete item:', item);
        // TODO: Implement delete confirmation and API call
    };

    return (
        <div className="dashboard-parent">
            <div className="dashboard-sidebar">
                <ObjectTypeExplorer
                    items={objectTypes}
                    onSelect={(type) => setSelectedType(type)}
                />
            </div>
            <div className="dashboard-content">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-8">
                        {objectTypes.find(ot => ot.id === selectedType)?.label || 'Items'}
                    </h2>
                    <PagedEntityTable
                        entityTypeName={selectedType}
                        columns={columnDefinitionsRegistry[selectedType]?.default || defaultColumnDefinitions.default}
                        initialQuery={{ page: 1, pageSize: 10 }}
                        onRowClick={(row) => handleView(selectedType, row)}
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
                </div>
            </div>
        </div>
    );
};

export default ObjectDashboard;
