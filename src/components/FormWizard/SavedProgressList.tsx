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
            InProgress: 'bg-blue-100 text-blue-800',
            Paused: 'bg-yellow-100 text-yellow-800',
            Completed: 'bg-green-100 text-green-800',
            Abandoned: 'bg-red-100 text-red-800'
        };

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="mt-8 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-gray-400" />
                    Saved Progress
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Continue where you left off
                </p>
            </div>
            <div className="divide-y divide-gray-200">
                {progressList.map((progress) => (
                    <div key={progress.id} className="px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                    <h3 className="text-sm font-medium text-gray-900">
                                        {getConfigName(progress)}
                                    </h3>
                                    {getStatusBadge(progress.status)}
                                </div>
                                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                                    <span>Step {progress.currentStepIndex + 1}</span>
                                    <span>•</span>
                                    <span>
                                        Last updated: {progress.updatedAt ? new Date(progress.updatedAt).toLocaleString() : '-'}
                                    </span>
                                    <span>•</span>
                                    <span>
                                        Created: {progress.createdAt ? new Date(progress.createdAt).toLocaleString() : '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => onResume(progress)}
                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
                                >
                                    <PlayCircle className="h-4 w-4 mr-1" />
                                    Resume
                                </button>
                                <button
                                    onClick={() => onDelete(progress)}
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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

