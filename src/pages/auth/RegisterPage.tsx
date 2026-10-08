import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

/** How long the "Done" step shows before the player lands on their account page. */
const DONE_REDIRECT_MS = 3000;

export const RegisterPage: React.FC = () => {
    usePageTitle('Create account');
    const navigate = useNavigate();
    const { isLoggedIn, isLoading } = useAuth();
    // Set before the account is created, so logging in through the form isn't mistaken for
    // "already logged in".
    const [registering, setRegistering] = useState(false);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Someone who is already logged in has an account: send them to it.
    useEffect(() => {
        if (!isLoading && isLoggedIn && !registering) {
            navigate('/account', { replace: true });
        }
    }, [isLoading, isLoggedIn, registering, navigate]);

    useEffect(() => () => {
        if (redirectTimer.current) clearTimeout(redirectTimer.current);
    }, []);

    const handleSuccess = () => {
        redirectTimer.current = setTimeout(() => navigate('/account'), DONE_REDIRECT_MS);
    };

    return (
        <main className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                        Create Your Account
                    </h1>
                    <p className="mt-2 text-base sm:text-lg text-gray-600">
                        Your web account belongs to your Minecraft account. Get a code in game, then pick an email and a password.
                    </p>
                </div>

                <RegisterForm onRegistering={setRegistering} onRegistrationSuccess={handleSuccess} />

                <p className="mt-6 text-sm text-gray-600 text-center">
                    Already have an account?{' '}
                    <Link to="/auth/login" className="text-primary hover:text-primary-dark font-medium">Log in</Link>
                </p>
            </div>
        </main>
    );
};
