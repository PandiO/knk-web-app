import React from 'react';
import { PlayCircle, Trash2, Clock } from 'lucide-react';
import { FormSubmissionProgressDto, FormSubmissionProgressSummaryDto } from '../../types/dtos/forms/FormModels';

type ProgressItem = FormSubmissionProgressDto | FormSubmissionProgressSummaryDto;

interface Props {
    progressList: ProgressItem[];
    onResume: (progress: ProgressItem) => void;
    onDelete: (progress: ProgressItem) => void;
}

export const SavedProgressList: React.FC<Props> = ({
    progressList,
    onResume,
    onDelete
}) => {
    if (progressList.length === 0) {
        return null;
    }

    const isFullProgress = (item: ProgressItem): item is FormSubmissionProgressDto => {
        return 'configuration' in item;
    };

    const getConfigName = (item: ProgressItem): string => {
        if (isFullProgress(item)) {
            return item.configuration?.configurationName || 'Untitled Form';
        }
        return (item as FormSubmissionProgressSummaryDto).formConfigurationName || 'Untitled Form';
    };

    const getStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            Draft: 'bg-gray-100 text-gray-800',
            InProgress: 'bg-info-muted text-info-strong',
            Paused: 'bg-warning-muted text-warning-strong',
            Completed: 'bg-success-muted text-success-strong',
            Abandoned: 'bg-danger-muted text-danger-strong'
        };

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="mt-8 bg-surface rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
                <h2 className="text-lg font-medium text-fg flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-muted" />
                    Saved Progress
                </h2>
                <p className="mt-1 text-sm text-muted">
                    Continue where you left off
                </p>
            </div>
            <div className="divide-y divide-line">
                {progressList.map((progress) => (
                    <div key={progress.id} className="px-6 py-4 hover:bg-surface-alt">
                        {/* #266: below sm the buttons go under the text and the details wrap, so a row is never
                            wider than the card at phone width. */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h3 className="text-sm font-medium text-fg">
                                        {getConfigName(progress)}
                                    </h3>
                                    {getStatusBadge(progress.status)}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                                    <span>Step {progress.currentStepIndex + 1}</span>
                                    <span className="hidden sm:inline" aria-hidden="true">•</span>
                                    <span>
                                        Last updated: {progress.updatedAt ? new Date(progress.updatedAt).toLocaleString() : '-'}
                                    </span>
                                    <span className="hidden sm:inline" aria-hidden="true">•</span>
                                    <span>
                                        Created: {progress.createdAt ? new Date(progress.createdAt).toLocaleString() : '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center space-x-2">
                                <button
                                    onClick={() => onResume(progress)}
                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-primary-fg bg-primary hover:bg-primary-dark"
                                >
                                    <PlayCircle className="h-4 w-4 mr-1" />
                                    Resume
                                </button>
                                <button
                                    onClick={() => onDelete(progress)}
                                    aria-label="Delete saved progress"
                                    title="Delete saved progress"
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-surface hover:bg-surface-alt"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

