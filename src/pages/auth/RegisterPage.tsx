import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { ErrorView } from '../../components/ErrorView';
import { ErrorColor } from '../../utils';

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = React.useState<string | null>(null);

    const handleSuccess = (linkCode?: string) => {
        navigate('/auth/register/success', {
            state: { linkCode }
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12">
            <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
                    <p className="mt-2 text-gray-600">
                        Start your Knights & Kings journey by setting up your web account and linking your Minecraft username.
                    </p>
                </div>

                {error && (
                    <div className="mb-4">
                        <ErrorView content={error} color={ErrorColor.Red} />
                    </div>
                )}

                <RegisterForm
                    onRegistrationSuccess={handleSuccess}
                />
            </div>
        </div>
    );
};
