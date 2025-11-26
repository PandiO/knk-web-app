import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormWizard } from '../components/FormWizard/FormWizard';
import ObjectTypeExplorer from '../components/ObjectTypeExplorer';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { typeName: string; objectTypes: ObjectType[] };

export const FormWizardPage: React.FC<Props> = ({ typeName, objectTypes }: Props) => {
    const { entityName } = useParams<{ entityName: string }>();
    const navigate = useNavigate();
    const [selectedTypeName, setSelectedTypeName] = useState(typeName || entityName || '');

    useEffect(() => {
        // changed: if prop is empty, use the URL param
        if (!typeName || typeName.trim() === '') {
            setSelectedTypeName(entityName || '');
        } else {
            setSelectedTypeName(typeName);
        }
    }, [typeName, entityName]);

    const userId = '1';

    const handleComplete = (data: any) => {
        console.log('Form completed with data:', data);
        // navigate('/dashboard');
    };

    const fetchDefaultFormConfig = ({ type }: { type: string }) => {
        setSelectedTypeName(type);
        console.log('Fetched typeName: ', type);
    };

    return (
        <div className="dashboard-parent">
            <div className='dashboard-sidebar'>
                <ObjectTypeExplorer
                    items={objectTypes}
                    onSelect={(type) => fetchDefaultFormConfig({ type })}
                />
            </div>
            <div className='dashboard-content'>
                <FormWizard
                    entityName={selectedTypeName || ''}
                    userId={userId}
                    onComplete={handleComplete}
                />
            </div>
        </div>
    );
};
