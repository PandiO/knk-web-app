import React from 'react';
import { useLocation } from 'react-router-dom';

// Catches render errors so one broken component doesn't white-screen the whole app (X-4, KNG-141).
// RouteErrorBoundary resets it on navigation, so the next page renders normally.

interface ErrorBoundaryProps {
    resetKey?: string;
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Page crashed:', error, info.componentStack);
    }

    componentDidUpdate(previous: ErrorBoundaryProps) {
        if (this.state.error && previous.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    render() {
        if (!this.state.error) {
            return this.props.children;
        }
        return (
            <div role="alert" className="mx-auto max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-gray-900">Something went wrong on this page</h1>
                <p className="mt-2 text-sm text-gray-600">
                    The rest of the site still works. Reload to try again, or go back to the home page.
                </p>
                <div className="mt-4 flex gap-3">
                    <button type="button" className="btn-primary text-sm" onClick={() => window.location.reload()}>
                        Reload
                    </button>
                    <a href="/" className="btn-secondary text-sm">Home</a>
                </div>
            </div>
        );
    }
}

/** An ErrorBoundary that resets when the path changes. Must be inside the Router. */
export const RouteErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
};
