import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '../../components/auth/RegisterForm';

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSuccess = () => {
        // Wait briefly for the feedback modal to be dismissed, then navigate
        // User is already authenticated from the register() and refresh() calls
        setTimeout(() => {
            navigate('/account');
        }, 2500);
    };

    return (
        <main className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded px-2 py-1">
                        Create Your Account
                    </h1>
                    <p className="mt-2 text-base sm:text-lg text-gray-600">
                        Start your Knights & Kings journey by setting up your web account and linking your Minecraft username.
                    </p>
                </div>

                <RegisterForm
                    onRegistrationSuccess={handleSuccess}
                />

                {/* Help text for keyboard users */}
                <p className="mt-6 text-xs text-gray-500 text-center">
                    This form is fully keyboard accessible. Use Tab to navigate between fields and buttons.
                </p>
            </div>
        </main>
    );
};
