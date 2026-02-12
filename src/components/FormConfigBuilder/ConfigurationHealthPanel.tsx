import React, { useEffect, useMemo, useState } from 'react';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';
import { ValidationIssueDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { FormConfigurationDto } from '../../types/dtos/forms/FormConfigurationDtos';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldQuestion, Info, Wrench } from 'lucide-react';

interface ConfigurationHealthPanelProps {
    configurationId?: string;
    draftConfig?: FormConfigurationDto;
    refreshToken?: number;
    onIssuesLoaded?: (count: number) => void;
}

export const ConfigurationHealthPanel: React.FC<ConfigurationHealthPanelProps> = ({
    configurationId,
    draftConfig,
    refreshToken,
    onIssuesLoaded
}) => {
    const [issues, setIssues] = useState<ValidationIssueDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});

    const configIdNumber = configurationId ? Number(configurationId) : undefined;

    const loadHealthCheck = async () => {
        // If we have a draft config, validate it directly (real-time validation)
        if (draftConfig) {
            try {
                setLoading(true);
                setError(null);
                const result = await fieldValidationRuleClient.validateDraftConfiguration(draftConfig);
                setIssues(result);
                onIssuesLoaded?.(result.length);
            } catch (err: any) {
                console.error('Failed to validate draft configuration:', err);
                const message = err?.response?.data?.message || err?.message || 'Unable to validate configuration.';
                setError(message);
                onIssuesLoaded?.(0);
            } finally {
                setLoading(false);
            }
            return;
        }

        // Otherwise, validate saved configuration by ID
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
    }, [configIdNumber, refreshToken, draftConfig]);

    const categorizeIssue = (issue: ValidationIssueDto): string => {
        const message = (issue.message || '').toLowerCase();
        if (message.includes('entity') && message.includes('metadata')) return 'fieldAlignment';
        if (message.includes('dependency path') || message.includes('invalid dependency path') || message.includes('property')) return 'propertyValidation';
        if (message.includes('required') && (message.includes('not in the form') || message.includes('optional'))) return 'requiredFields';
        if (message.includes('collection') || message.includes('array')) return 'collectionWarning';
        if (message.includes('circular dependency')) return 'circularDependency';
        if (message.includes('depends on') && (message.includes('after') || message.includes('reorder'))) return 'fieldOrdering';
        if (message.includes('unknown validation type')) return 'general';
        return 'general';
    };

    const sectionDefinitions = useMemo(() => ([
        {
            key: 'fieldAlignment',
            title: 'Field Alignment',
            severity: 'error',
            description: 'Ensure fields align with entity metadata.'
        },
        {
            key: 'propertyValidation',
            title: 'Property Validation',
            severity: 'error',
            description: 'Dependency paths must reference valid properties.'
        },
        {
            key: 'requiredFields',
            title: 'Required Field Completeness',
            severity: 'warning',
            description: 'Required entity fields should be present and required in the form.',
            canAutoFix: true
        },
        {
            key: 'collectionWarning',
            title: 'Collection Warning',
            severity: 'warning',
            description: 'Collection navigation is not supported in v1.'
        },
        {
            key: 'circularDependency',
            title: 'Circular Dependency',
            severity: 'error',
            description: 'Remove cycles in validation dependencies.'
        },
        {
            key: 'fieldOrdering',
            title: 'Field Ordering',
            severity: 'warning',
            description: 'Dependencies should appear before dependent fields.'
        },
        {
            key: 'general',
            title: 'General',
            severity: 'info',
            description: 'Other validation feedback.'
        }
    ]), []);

    const groupedIssues = useMemo(() => {
        const buckets: Record<string, ValidationIssueDto[]> = {};
        sectionDefinitions.forEach(section => {
            buckets[section.key] = [];
        });

        issues.forEach(issue => {
            const key = categorizeIssue(issue);
            if (!buckets[key]) {
                buckets.general = buckets.general || [];
                buckets.general.push(issue);
                return;
            }
            buckets[key].push(issue);
        });

        return buckets;
    }, [issues, sectionDefinitions]);

    const severityCounts = useMemo(() => {
        return issues.reduce(
            (acc, issue) => {
                const severity = (issue.severity || '').toLowerCase();
                if (severity === 'error') acc.errors += 1;
                else if (severity === 'warning') acc.warnings += 1;
                else acc.info += 1;
                return acc;
            },
            { errors: 0, warnings: 0, info: 0 }
        );
    }, [issues]);

    const toggleIssue = (key: string) => {
        setExpandedIssues(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    if (!configIdNumber && !draftConfig) {
        return (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-md p-4 text-sm text-gray-600">
                Save this configuration to enable health checks.
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4" data-testid="health-panel">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-md font-semibold text-gray-900">Configuration Health</h3>
                    <p className="text-xs text-gray-500">Review dependency paths, ordering, and validation coverage.</p>
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
                <div className="flex items-center text-sm text-gray-600" data-testid="health-check-loading">
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
                <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800 flex items-center" data-testid="health-status-icon">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Configuration is healthy.
                </div>
            )}

            {!loading && !error && issues.length > 0 && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {severityCounts.errors} errors
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                            {severityCounts.warnings} warnings
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {severityCounts.info} info
                        </span>
                    </div>

                    {sectionDefinitions.map(section => {
                        const sectionIssues = groupedIssues[section.key] || [];
                        const isExpanded = sectionIssues.length > 0;
                        const sectionKey = `health-section-${section.key}`;

                        return (
                            <HealthCheckSection
                                key={section.key}
                                sectionKey={sectionKey}
                                title={section.title}
                                severity={section.severity}
                                description={section.description}
                                issues={sectionIssues}
                                canAutoFix={section.canAutoFix}
                                onAutoFix={section.canAutoFix ? () => {} : undefined}
                                isExpanded={isExpanded}
                                expandedIssues={expandedIssues}
                                onToggleIssue={toggleIssue}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface HealthCheckSectionProps {
    sectionKey: string;
    title: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
    issues: ValidationIssueDto[];
    canAutoFix?: boolean;
    onAutoFix?: () => void;
    isExpanded: boolean;
    expandedIssues: Record<string, boolean>;
    onToggleIssue: (key: string) => void;
}

const HealthCheckSection: React.FC<HealthCheckSectionProps> = ({
    sectionKey,
    title,
    severity,
    description,
    issues,
    canAutoFix,
    onAutoFix,
    isExpanded,
    expandedIssues,
    onToggleIssue
}) => {
    const hasIssues = issues.length > 0;
    const colorClass = severity === 'error'
        ? 'border-red-200 bg-red-50'
        : severity === 'warning'
        ? 'border-yellow-200 bg-yellow-50'
        : 'border-blue-200 bg-blue-50';
    const Icon = severity === 'error' ? ShieldAlert : severity === 'warning' ? AlertTriangle : Info;

    return (
        <div className={`border rounded-md p-3 space-y-2 ${colorClass}`} data-testid={sectionKey}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-0.5" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                            <span className="text-xs text-gray-600">{issues.length} issue{issues.length === 1 ? '' : 's'}</span>
                        </div>
                        <p className="text-xs text-gray-600">{description}</p>
                    </div>
                </div>
                {canAutoFix && (
                    <button
                        className="btn-secondary text-xs flex items-center"
                        onClick={onAutoFix}
                        disabled={!hasIssues || !onAutoFix}
                    >
                        <Wrench className="h-3 w-3 mr-1" />
                        Quick Fix
                    </button>
                )}
            </div>

            {!hasIssues && (
                <p className="text-xs text-gray-600">No issues detected.</p>
            )}

            {hasIssues && isExpanded && (
                <div className="space-y-2">
                    {issues.map((issue, idx) => {
                        const issueKey = `${sectionKey}-${idx}-${issue.fieldId ?? 'none'}-${issue.ruleId ?? 'none'}`;
                        const expanded = expandedIssues[issueKey] || false;
                        return (
                            <div key={issueKey} className="bg-white border border-gray-200 rounded-md p-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="text-xs text-gray-800">{issue.message}</div>
                                    <button
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                        onClick={() => onToggleIssue(issueKey)}
                                    >
                                        {expanded ? 'Hide details' : 'Details'}
                                    </button>
                                </div>
                                {expanded && (
                                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                                        {issue.fieldId && <div>Field ID: {issue.fieldId}</div>}
                                        {issue.ruleId && <div>Rule ID: {issue.ruleId}</div>}
                                        <div>Severity: {issue.severity}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
