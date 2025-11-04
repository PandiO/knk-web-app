import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormWizard } from '../components/FormWizard/FormWizard';

export const FormWizardPage: React.FC = () => {
    const { entityName } = useParams<{ entityName: string }>();
    const navigate = useNavigate();

    // TODO: Get actual user ID from auth context
    const userId = 'current-user-id';

    const handleComplete = (data: any) => {
        console.log('Form completed with data:', data);
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <FormWizard
                    entityName={entityName || ''}
                    userId={userId}
                    onComplete={handleComplete}
                />
            </div>
        </div>
    );
};
