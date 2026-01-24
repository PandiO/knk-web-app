import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FeedbackModal } from '../../components/FeedbackModal';
import { SUCCESS_MESSAGES } from '../../utils/authConstants';

interface LocationState {
    linkCode?: string;
}

export const RegisterSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state || {}) as LocationState;
    const linkCode = state.linkCode;
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        if (!linkCode) return;
        try {
            await navigator.clipboard.writeText(linkCode);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12 bg-gray-50">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Account Created</h1>
                    <p className="mt-2 text-gray-600">
                        Your account is ready. Use the link code below on the Minecraft server to complete linking.
                    </p>
                </div>

                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700">Link Code</p>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-2xl font-bold text-gray-900" data-testid="link-code">
                            {linkCode || 'Code unavailable'}
                        </span>
                        <button
                            onClick={handleCopy}
                            disabled={!linkCode}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md disabled:opacity-50"
                        >
                            Copy
                        </button>
                    </div>
                    <p className="mt-3 text-xs text-gray-600">
                        Use /account link [code] in-game. Codes typically expire after a short time.
                    </p>
                </div>

                <div className="mt-8 flex justify-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Back to Landing
                    </button>
                    <button
                        onClick={() => navigate('/auth/login')}
                        className="px-5 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                    >
                        Continue to Login
                    </button>
                </div>
            </div>

            <FeedbackModal
                open={copied}
                title="Link code copied"
                message={SUCCESS_MESSAGES.LinkCodeCopied}
                status="success"
                onClose={() => setCopied(false)}
                autoCloseMs={1500}
            />
        </div>
    );
};
