import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Server, Gamepad2, Link as LinkIcon } from 'lucide-react';
import { LinkCodeDisplay } from '../../components/auth/LinkCodeDisplay';
import { FeedbackModal } from '../../components/FeedbackModal';
import { SUCCESS_MESSAGES } from '../../utils/authConstants';

interface LocationState {
    linkCode?: string;
    expiresAt?: string;
}

export const RegisterSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state || {}) as LocationState;
    const linkCode = state.linkCode;
    const expiresAt = state.expiresAt;
    const [showFeedback, setShowFeedback] = React.useState(false);
    const [autoRedirectCountdown, setAutoRedirectCountdown] = React.useState(5);

    // Auto-redirect to login after 5 seconds
    useEffect(() => {
        if (autoRedirectCountdown <= 0) {
            navigate('/auth/login');
            return;
        }

        const timer = setTimeout(() => {
            setAutoRedirectCountdown(autoRedirectCountdown - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [autoRedirectCountdown, navigate]);

    const handleCopySuccess = () => {
        setShowFeedback(true);
    };

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

                {/* Link Code Display */}
                <div className="mb-8 sm:mb-10">
                    <LinkCodeDisplay
                        code={linkCode || ''}
                        expiresAt={expiresAt}
                        onCopySuccess={handleCopySuccess}
                    />
                </div>

                {/* Next Steps */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 sm:p-8 mb-8 sm:mb-10">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">Next Steps to Link Your Minecraft Account</h2>
                    
                    <div className="space-y-4" role="region" aria-label="Account linking instructions">
                        {/* Step 1 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white font-bold text-sm" aria-label="Step 1">
                                    1
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Launch Minecraft</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Open Minecraft Java Edition (version 1.20+)
                                </p>
                            </div>
                            <Gamepad2 className="h-6 w-6 text-blue-500 flex-shrink-0 opacity-50 hidden sm:block" aria-hidden="true" />
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white font-bold text-sm" aria-label="Step 2">
                                    2
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Join the Knights & Kings Server</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Server address: <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">knk.example.com</code>
                                </p>
                            </div>
                            <Server className="h-6 w-6 text-blue-500 flex-shrink-0 opacity-50 hidden sm:block" aria-hidden="true" />
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white font-bold text-sm" aria-label="Step 3">
                                    3
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Enter the Link Command</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    In chat, type: <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs break-all">/account link {linkCode || 'YOUR_CODE'}</code>
                                </p>
                            </div>
                            <LinkIcon className="h-6 w-6 text-blue-500 flex-shrink-0 opacity-50 hidden sm:block" aria-hidden="true" />
                        </div>

                        {/* Step 4 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500 text-white font-bold text-sm" aria-label="Step 4 complete">
                                    ✓
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-base">Accounts Linked</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Your web account and Minecraft account will be linked. You can now access exclusive features!
                                </p>
                            </div>
                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 opacity-50 hidden sm:block" aria-hidden="true" />
                        </div>
                    </div>
                </div>

                {/* Important Info */}
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 sm:p-6 mb-8 sm:mb-10" role="region" aria-label="Important information">
                    <h3 className="font-semibold text-amber-900 mb-2">⏱️ Link Code Expiry</h3>
                    <p className="text-sm text-amber-800">
                        This link code is valid for <strong>20 minutes</strong>. After that, you'll need to generate a new one from your dashboard.
                        Codes can only be used once.
                    </p>
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
                        onClick={() => navigate('/auth/login')}
                        className="px-6 py-3 text-base bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        aria-label="Continue to login page"
                    >
                        Continue to Login
                    </button>
                </div>

                {/* Auto-redirect Message */}
                <div className="text-center" role="status" aria-live="polite" aria-atomic="true">
                    <p className="text-sm text-gray-500">
                        Redirecting to login page in <span className="font-semibold text-gray-700" aria-label={`${autoRedirectCountdown} seconds remaining`}>{autoRedirectCountdown}</span> second{autoRedirectCountdown !== 1 ? 's' : ''}...
                    </p>
                </div>
            </div>

            {/* Copy Success Feedback */}
            <FeedbackModal
                open={showFeedback}
                title="Link code copied"
                message={SUCCESS_MESSAGES.LinkCodeCopied || 'Link code has been copied to your clipboard'}
                status="success"
                onClose={() => setShowFeedback(false)}
                autoCloseMs={1500}
            />
        </main>
    );
};
