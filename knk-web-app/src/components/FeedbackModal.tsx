import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type FeedbackStatus = 'success' | 'error' | 'info';

interface FeedbackModalProps {
    open: boolean;
    title: string;
    message: string;
    status?: FeedbackStatus;
    onClose: () => void;
    onContinue?: () => void;
    continueLabel?: string;
    autoCloseMs?: number;
}

// Simple feedback modal with outside-click close and optional auto-close timer
export const FeedbackModal: React.FC<FeedbackModalProps> = ({
    open,
    title,
    message,
    status = 'info',
    onClose,
    onContinue,
    continueLabel = 'Continue',
    autoCloseMs
}) => {
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

    useEffect(() => {
        if (!open || !autoCloseMs) {
            setSecondsRemaining(null);
            return;
        }

        setSecondsRemaining(Math.ceil(autoCloseMs / 1000));

        const countdownInterval = window.setInterval(() => {
            setSecondsRemaining(prev => {
                if (prev === null || prev <= 1) {
                    window.clearInterval(countdownInterval);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        const timerId = window.setTimeout(() => {
            // Prefer continue action when provided, otherwise just close
            if (onContinue) {
                onContinue();
            }
            onClose();
        }, autoCloseMs);

        return () => {
            window.clearTimeout(timerId);
            window.clearInterval(countdownInterval);
        };
    }, [open, autoCloseMs, onClose, onContinue]);

    if (!open) return null;

    const iconMap: Record<FeedbackStatus, JSX.Element> = {
        success: <CheckCircle2 className="h-6 w-6 text-green-600" />,
        error: <XCircle className="h-6 w-6 text-red-600" />,
        info: <Info className="h-6 w-6 text-blue-600" />
    };

    const borderClass: Record<FeedbackStatus, string> = {
        success: 'border-green-100',
        error: 'border-red-100',
        info: 'border-blue-100'
    };

    const bgClass: Record<FeedbackStatus, string> = {
        success: 'bg-green-50',
        error: 'bg-red-50',
        info: 'bg-blue-50'
    };

    const textClass: Record<FeedbackStatus, string> = {
        success: 'text-green-800',
        error: 'text-red-800',
        info: 'text-blue-800'
    };

    const handleContinue = () => {
        if (onContinue) {
            onContinue();
        }
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
            onClick={onClose}
        >
            <div
                className={`w-full max-w-md rounded-lg shadow-lg border ${borderClass[status]} ${bgClass[status]} relative`}
                onClick={e => e.stopPropagation()}
            >
                {/* Auto-close countdown */}
                {autoCloseMs && secondsRemaining !== null && (
                    <div className="absolute top-3 right-12 text-xs text-gray-400 opacity-70">
                        Closing in {secondsRemaining}s...
                    </div>
                )}

                <div className="flex items-start justify-between px-5 py-4">
                    <div className="flex items-start space-x-3">
                        {iconMap[status]}
                        <div>
                            <h3 className={`text-lg font-semibold ${textClass[status]}`}>{title}</h3>
                            <p className="mt-1 text-sm text-gray-700">{message}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-5 pb-4 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleContinue}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md"
                    >
                        {continueLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
