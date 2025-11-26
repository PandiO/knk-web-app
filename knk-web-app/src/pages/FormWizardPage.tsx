import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormWizard } from '../components/FormWizard/FormWizard';
import ObjectTypeExplorer from '../components/ObjectTypeExplorer';
import { objectConfigs } from '../config/objectConfigs';
import { formConfigClient } from '../io/formConfigClient';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { typeName: string; objectTypes: ObjectType[] };

export const FormWizardPage: React.FC<Props> = ({ typeName, objectTypes }: Props) => {
    const { entityName } = useParams<{ entityName: string }>();
    const navigate = useNavigate();
    const [selectedTypeName, setSelectedTypeName] = useState(typeName || entityName || '');
    const [loading, setLoading] = useState(true);
    // changed: keep only normalized entity names from API
    const [entityNamesLower, setEntityNamesLower] = useState<string[]>([]);

    useEffect(() => {
        // changed: if prop is empty, use the URL param
        if (!typeName || typeName.trim() === '') {
            setSelectedTypeName(entityName || '');
        } else {
            setSelectedTypeName(typeName);
        }
    }, [typeName, entityName]);

    // changed: fetch entity names and store normalized list
    useEffect(() => {
        const fetchAvailableEntityNames = async () => {
            try {
                setLoading(true);
                const entityNames = await formConfigClient.getEntityNames();
                const normalized = (entityNames || [])
                    .map((n: string) => n?.trim().toLowerCase())
                    .filter(Boolean);
                setEntityNamesLower(normalized);
            } catch (error) {
                console.error('Failed to fetch entity names:', error);
                // fallback: show all provided objectTypes if API fails
                setEntityNamesLower(
                    Object.keys(objectConfigs).map(k => k.toLowerCase())
                );
            } finally {
                setLoading(false);
            }
        };
        fetchAvailableEntityNames();
    }, [objectTypes]);

    // added: derive filtered sidebar items from objectConfigs + normalized names
    const sidebarItems = useMemo(() => {
        let items = Object.entries(objectConfigs)
            .filter(([key, config]) => {
                const keyLower = key.toLowerCase();
                const typeLower = (config.type || '').toLowerCase();
                const labelLower = (config.label || '').toLowerCase();
                return (
                    entityNamesLower.includes(keyLower) ||
                    entityNamesLower.includes(typeLower) ||
                    entityNamesLower.includes(labelLower)
                );
            })
            .map(([type, config]) => ({
                id: type,
                label: config.label,
                icon: config.icon,
                createRoute: `/forms/${type}`,
            }));
            console.log('Filtered sidebar items:', items);
        return items;
    }, [entityNamesLower]);

    const userId = '1';

    const handleComplete = (data: any) => {
        console.log('Form completed with data:', data);
        // navigate('/dashboard');
    };

    const fetchDefaultFormConfig = ({ type }: { type: string }) => {
        setSelectedTypeName(type);
        console.log('Fetched typeName: ', type);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading available forms...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-parent">
            <div className='dashboard-sidebar'>
                <ObjectTypeExplorer
                    // changed: pass memoized derived items
                    items={sidebarItems}
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
