import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Server, Gamepad2, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LinkCodeResponseDto } from '../../types/dtos/auth/AuthDtos';

export const RegisterSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();
    const [autoRedirectCountdown, setAutoRedirectCountdown] = React.useState(5);
    const redirectTarget = isLoggedIn ? '/dashboard' : '/auth/login';
    const location = useLocation();
    const linkCode = (location.state as { linkCode?: LinkCodeResponseDto } | null)?.linkCode;
    const linkCodeExpiresInMinutes = linkCode?.expiresAt
        ? Math.max(1, Math.ceil((new Date(linkCode.expiresAt).getTime() - Date.now()) / 60000))
        : undefined;

    // Auto-redirect after 5 seconds
    useEffect(() => {
        if (autoRedirectCountdown <= 0) {
            navigate(redirectTarget);
            return;
        }

        const timer = setTimeout(() => {
            setAutoRedirectCountdown(autoRedirectCountdown - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [autoRedirectCountdown, navigate, redirectTarget]);

    return (
        <main className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 border border-gray-100">
                
                {/* Success Header */}
                <div className="text-center mb-8 sm:mb-10">
                    <div className="flex justify-center mb-4">
                        <div className="relative">
                            <CheckCircle className="h-16 w-16 text-green-500" strokeWidth={1.5} aria-hidden="true" />
                        </div>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
                        Account Created!
                    </h1>
                    <p className="text-base sm:text-lg text-gray-600">
                        Welcome to Knights & Kings. Your account is ready to use.
                    </p>
                </div>

                {/* Link Code Guidance */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 sm:p-8 mb-8 sm:mb-10">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Next: Link Your Minecraft Account</h2>
                    
                        {linkCode && (
                            <div className="bg-green-50 rounded-lg border border-green-200 p-4 mb-6">
                                <p className="text-sm font-semibold text-green-900 mb-2">Your Link Code (Generated)</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-white px-3 py-2 rounded border border-green-300 font-mono text-sm text-gray-900 break-all">
                                        {linkCode.code}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(linkCode.code);
                                        }}
                                        className="px-3 py-2 text-xs font-semibold bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                        aria-label="Copy link code to clipboard"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="text-xs text-green-800 mt-2">
                                    Expires in {linkCodeExpiresInMinutes ?? 20} minutes
                                </p>
                            </div>
                        )}
                    
                    <div className="text-sm text-blue-900 space-y-2 mb-4">
                        <p>Your web account is now created! To connect it with your Minecraft account:</p>
                    </div>

                    <div className="space-y-4" role="region" aria-label="Account linking instructions">
                        {/* Step 1 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white font-bold text-sm" aria-label="Step 1">
                                    1
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Go to Account Settings</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Click the Account link in the navigation menu to access your account settings
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white font-bold text-sm" aria-label="Step 2">
                                    2
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Generate Link Code</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Click "Generate Link Code" and copy the code that appears
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white font-bold text-sm" aria-label="Step 3">
                                    3
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Join Minecraft Server</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Open Minecraft and join the Knights & Kings server
                                </p>
                            </div>
                            <Gamepad2 className="h-6 w-6 text-blue-500 flex-shrink-0 opacity-50 hidden sm:block" aria-hidden="true" />
                        </div>

                        {/* Step 4 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white font-bold text-sm" aria-label="Step 4">
                                    4
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Enter Link Command</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    In game chat, type: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-xs">/account link YOUR_CODE</code>
                                </p>
                            </div>
                            <LinkIcon className="h-6 w-6 text-blue-500 flex-shrink-0 opacity-50 hidden sm:block" aria-hidden="true" />
                        </div>

                        {/* Step 5 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500 text-white font-bold text-sm" aria-label="Step 5 complete">
                                    ✓
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Accounts Linked</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Your web and Minecraft accounts are now connected. Enjoy the full experience!
                                </p>
                            </div>
                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 opacity-50 hidden sm:block" aria-hidden="true" />
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 text-base border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        aria-label="Return to landing page"
                    >
                        Back to Landing
                    </button>
                    <button
                        onClick={() => navigate(redirectTarget)}
                        className="px-6 py-3 text-base bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        aria-label={isLoggedIn ? 'Continue to dashboard' : 'Continue to login page'}
                    >
                        {isLoggedIn ? 'Continue to Dashboard' : 'Continue to Login'}
                    </button>
                </div>

                {/* Auto-redirect Message */}
                <div className="text-center" role="status" aria-live="polite" aria-atomic="true">
                    <p className="text-sm text-gray-500">
                        Redirecting to {isLoggedIn ? 'dashboard' : 'login page'} in <span className="font-semibold text-gray-700" aria-label={`${autoRedirectCountdown} seconds remaining`}>{autoRedirectCountdown}</span> second{autoRedirectCountdown !== 1 ? 's' : ''}...
                    </p>
                </div>
            </div>
        </main>
    );
};
