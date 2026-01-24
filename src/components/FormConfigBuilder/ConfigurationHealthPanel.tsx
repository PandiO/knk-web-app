import React, { useEffect, useState } from 'react';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';
import { ValidationIssueDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldQuestion } from 'lucide-react';

interface ConfigurationHealthPanelProps {
    configurationId?: string;
    refreshToken?: number;
    onIssuesLoaded?: (count: number) => void;
}

export const ConfigurationHealthPanel: React.FC<ConfigurationHealthPanelProps> = ({
    configurationId,
    refreshToken,
    onIssuesLoaded
}) => {
    const [issues, setIssues] = useState<ValidationIssueDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const configIdNumber = configurationId ? Number(configurationId) : undefined;

    const loadHealthCheck = async () => {
        if (!configIdNumber || Number.isNaN(configIdNumber)) {
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const result = await fieldValidationRuleClient.validateConfigurationHealth(configIdNumber);
            setIssues(result);
            onIssuesLoaded?.(result.length);
        } catch (err: any) {
            console.error('Failed to load configuration health:', err);
            const message = err?.response?.data?.message || err?.message || 'Unable to load configuration health.';
            setError(message);
            onIssuesLoaded?.(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadHealthCheck();
    }, [configIdNumber, refreshToken]);

    if (!configIdNumber) {
        return (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-md p-4 text-sm text-gray-600">
                Save this configuration to enable health checks.
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-md font-semibold text-gray-900">Configuration Health</h3>
                    <p className="text-xs text-gray-500">Checks cross-field validation dependencies and ordering.</p>
                </div>
                <button
                    onClick={loadHealthCheck}
                    className="btn-secondary text-sm flex items-center"
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {loading && (
                <div className="flex items-center text-sm text-gray-600">
                    <ShieldQuestion className="h-4 w-4 mr-2 text-blue-500" />
                    Checking configuration health...
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 flex items-start">
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && issues.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800 flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Configuration is healthy.
                </div>
            )}

            {!loading && !error && issues.length > 0 && (
                <div className="space-y-2">
                    {issues.map((issue, idx) => {
                        const severity = (issue.severity || '').toLowerCase();
                        const isError = severity === 'error';
                        const isWarning = severity === 'warning';
                        const colorClass = isError
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : isWarning
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800';
                        const badgeClass = isError
                            ? 'bg-red-200 text-red-800'
                            : isWarning
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-blue-200 text-blue-800';
                        const Icon = isError ? ShieldAlert : isWarning ? AlertTriangle : ShieldQuestion;

                        return (
                            <div key={`${issue.message}-${idx}`} className={`border rounded-md p-3 ${colorClass}`}>
                                <div className="flex items-start space-x-2">
                                    <Icon className="h-4 w-4 mt-0.5" />
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}>
                                                {issue.severity || 'Info'}
                                            </span>
                                            {issue.fieldId && (
                                                <span className="text-xs text-gray-700">Field ID: {issue.fieldId}</span>
                                            )}
                                        </div>
                                        <p className="text-sm">{issue.message}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
