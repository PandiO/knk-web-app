import React, { useEffect, useState } from 'react';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import { WorldTaskReadDto } from '../../types/dtos/workflow/WorkflowDtos';
import { FormFieldDto, FormConfigurationDto } from '../../types/dtos/forms/FormModels';
import { CheckCircle, Copy, Check } from 'lucide-react';
import { useEnrichedFormContext } from '../../hooks/useEnrichedFormContext';

interface WorldBoundFieldRendererProps {
    field: FormFieldDto;
    value: any;
    onChange: (newValue: any) => void;
    taskType: string;
    allowExisting?: boolean;
    allowCreate?: boolean;
    workflowSessionId: number;
    stepNumber?: number;
    stepKey?: string;
    preResolvedPlaceholders?: Record<string, string>; // Phase 5.2: Pre-resolved placeholders from validation rules
    formConfiguration?: FormConfigurationDto; // Phase 7: Form configuration for dependency resolution context
    onTaskCompleted?: (task: WorldTaskReadDto, extractedValue: any) => void;
}

/**
 * Maps task types to their expected output field names in outputJson
 * For Location tasks, we extract raw coordinates and convert them to location objects
 */
const TASK_OUTPUT_FIELD_MAP: Record<string, string> = {
    'RegionCreate': 'regionId',
    'ReagionCreate': 'regionId', // Handle typo in current data
    'LocationCapture': 'location', // Extract as raw location data
    'CaptureLocation': 'location', // Alternative naming
    'Location': 'location', // Field name based
    'StructureCapture': 'structureId',
    'WgRegionId': 'regionId', // Field-based naming
};

/**
 * Extracts the result value from a completed WorldTask's outputJson
 * For Location tasks, converts raw coordinates to location object
 * For Region tasks, extracts the regionId directly
 */
function extractTaskResult(task: WorldTaskReadDto, taskType: string): any {
    if (!task.outputJson) return null;
    
    try {
        const output = JSON.parse(task.outputJson);
        
        // Special handling for Location tasks
        if (isLocationTask(taskType, task.taskType)) {
            // Extract raw location data and convert to location object
            if (output.x !== undefined && output.y !== undefined && output.z !== undefined) {
                const locationObject = {
                    x: output.x,
                    y: output.y,
                    z: output.z,
                    yaw: output.yaw ?? 0,
                    pitch: output.pitch ?? 0,
                    worldName: output.worldName ?? 'world'
                };
                console.log('Extracted location from task:', locationObject);
                return locationObject;
            }
        }
        
        // Use task-type mapping to find the correct field
        const expectedFieldName = TASK_OUTPUT_FIELD_MAP[taskType] || 
                                 TASK_OUTPUT_FIELD_MAP[task.taskType] ||
                                 null;
        
        if (expectedFieldName && expectedFieldName !== 'location' && output[expectedFieldName]) {
            return output[expectedFieldName];
        }
        
        // Fallback: try common result field names
        return output.regionId || output.structureId || 
               output.value || output.result || output.id;
    } catch (e) {
        console.error(`Failed to extract result from task ${task.id}:`, e);
        return null;
    }
}

/**
 * Check if the task type indicates a Location capture task
 */
function isLocationTask(taskType: string, actualTaskType?: string): boolean {
    const types = [taskType, actualTaskType].filter(Boolean).map(t => t?.toLowerCase() || '');
    return types.some(t => t.includes('location') || t.includes('capture'));
}

export const WorldBoundFieldRenderer: React.FC<WorldBoundFieldRendererProps> = ({
    field,
    value,
    onChange,
    taskType,
    allowExisting = false,
    allowCreate = true, // eslint-disable-line @typescript-eslint/no-unused-vars
    workflowSessionId,
    stepNumber,
    stepKey,
    preResolvedPlaceholders,
    formConfiguration,
    onTaskCompleted,
}) => {
    const [taskId, setTaskId] = useState<number | null>(null);
    const [task, setTask] = useState<WorldTaskReadDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [extractionSucceeded, setExtractionSucceeded] = useState(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);

    // Phase 7: Use enriched form context for dependency resolution
    const formContext = formConfiguration ? useEnrichedFormContext(formConfiguration) : null;

    // Poll task status when taskId is set
    useEffect(() => {
        console.log('Starting task status polling for taskId:', taskId);
        if (!taskId || extractionSucceeded) return;

        const pollInterval = setInterval(async () => {
            try {
                console.log('Polling status for WorldTask ID:', taskId);
                const updated = await worldTaskClient.getById(taskId);
                setTask(updated);

                // If task completed, extract output and bind to field
                if (updated.status === 'Completed' && updated.outputJson) {
                    console.log('WorldTask completed, extracting result:', updated);
                    // Use the task's actual taskType for extraction (not the prop)
                    const extractedValue = extractTaskResult(updated, updated.taskType || taskType);
                    
                    if (extractedValue) {
                        // Update field value
                        onChange(extractedValue);
                        setExtractionSucceeded(true);
                        setExtractionError(null);
                        
                        // Notify parent about successful completion
                        if (onTaskCompleted) {
                            onTaskCompleted(updated, extractedValue);
                        }
                        
                        console.log(`✓ WorldTask ${taskId} result extracted and field populated:`, extractedValue);
                    } else {
                        setExtractionError('Could not extract result from task output');
                        console.warn(`WorldTask ${taskId} completed but no result value found in output`);
                    }
                    
                    clearInterval(pollInterval);
                }

                // If task failed, show error and stop polling
                if (updated.status === 'Failed') {
                    setExtractionError(updated.errorMessage || 'Task failed in Minecraft');
                    console.error('WorldTask failed:', updated.errorMessage);
                    clearInterval(pollInterval);
                }
            } catch (error) {
                console.error('Failed to poll task status:', error);
            }
        }, 2000);  // Poll every 2 seconds

        return () => clearInterval(pollInterval);
    }, [taskId, extractionSucceeded, taskType, onChange, onTaskCompleted]);

    const handleCreateInMinecraft = async () => {
        setIsLoading(true);
        try {
            // Phase 5.2: Build input JSON with pre-resolved placeholders
            // Phase 7: Include enriched form context with resolved dependencies
            const inputData: any = {
                fieldName: field.fieldName,
                currentValue: value
            };

            // Include pre-resolved placeholders if available
            if (preResolvedPlaceholders && Object.keys(preResolvedPlaceholders).length > 0) {
                inputData.allPlaceholders = preResolvedPlaceholders;
                console.log('WorldTask created with pre-resolved placeholders:', preResolvedPlaceholders);
            }

            // Phase 7: Include enriched validation context if form configuration is available
            if (formContext) {
                const validationContext = {
                    formContextValues: formContext.values,
                    resolvedDependencies: Array.from(formContext.resolvedDependencies.values()),
                    entityMetadata: Array.from(formContext.entityMetadata.values()),
                    isLoading: formContext.isLoading,
                    error: formContext.error
                };
                inputData.validationContext = validationContext;
                console.log('WorldTask created with enriched validation context:', validationContext);
            }

            // Create world task via API
            const created = await worldTaskClient.create({
                workflowSessionId,
                stepNumber,
                stepKey: stepKey || field.formStepId || 'unknown',
                fieldName: field.fieldName,
                taskType: taskType,  // e.g., "WgRegionId"
                inputJson: JSON.stringify(inputData),
            });

            setTask(created);  // Set full task object immediately (includes linkCode)
            setTaskId(created.id);  // Start polling for status updates
        } catch (error) {
            console.error('Failed to create world task:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = async (code: string, taskId: number) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCodeId(taskId);
            setTimeout(() => setCopiedCodeId(null), 2000);
        } catch (error) {
            console.error('Failed to copy code:', error);
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>

            {/* Display current value with extraction success indicator */}
            {value && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
                    <p className="text-sm font-medium text-green-800">
                        ✓ {field.label}: <span className="font-mono text-green-900">{value}</span>
                    </p>
                    {extractionSucceeded && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Auto-populated
                        </span>
                    )}
                </div>
            )}

            {/* Prominent claim code display for Pending tasks */}
            {task && task.status === 'Pending' && task.linkCode && (
                <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-sm">
                    <div className="flex items-start">
                        <span className="text-3xl mr-3">🎮</span>
                        <div className="flex-1">
                            <p className="text-lg font-bold text-yellow-900 mb-2">
                                Ready for Minecraft!
                            </p>
                            <div className="bg-white p-3 rounded-md border border-yellow-300 mb-3">
                                <p className="text-sm text-gray-700 mb-1 font-medium">Claim Code:</p>
                                <div className="flex items-center gap-2">
                                    <code className="text-2xl font-mono font-bold text-yellow-900 tracking-wider">
                                        {task.linkCode}
                                    </code>
                                    <button
                                        onClick={() => handleCopyCode(task.linkCode!, task.id)}
                                        className="p-2 hover:bg-yellow-100 rounded transition-colors"
                                        title="Copy claim code"
                                    >
                                        {copiedCodeId === task.id ? (
                                            <Check className="h-5 w-5 text-green-600" />
                                        ) : (
                                            <Copy className="h-5 w-5 text-gray-600 hover:text-gray-900" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-gray-800 p-3 rounded-md">
                                <p className="text-xs text-gray-400 mb-1">In Minecraft, type:</p>
                                <code className="text-sm font-mono text-green-400">
                                    /knk task claim {task.linkCode}
                                </code>
                            </div>
                            <p className="text-xs text-yellow-700 mt-2">
                                💡 This code links your web session to your in-game actions
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Task in-progress state with claim info */}
            {task && (task.status === 'InProgress' || task.status === 'Accepted') && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                        Task Status: <strong>{task.status}</strong>
                    </p>
                    {task.claimedByMinecraftUsername && (
                        <p className="text-xs text-blue-700 mt-1">
                            Claimed by: <strong>{task.claimedByMinecraftUsername}</strong>
                            {task.claimedByServerId && ` on ${task.claimedByServerId}`}
                        </p>
                    )}
                    <p className="text-xs text-blue-600 mt-2">
                        Waiting for task to complete in Minecraft...
                    </p>
                </div>
            )}

            {/* Task completion in progress state */}
            {task && task.status === 'Completed' && !extractionSucceeded && !extractionError && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                        ⏳ Processing task result...
                    </p>
                </div>
            )}

            {/* Task completion success state */}
            {task && task.status === 'Completed' && extractionSucceeded && (
                <div className="mb-3 p-3 bg-green-50 border border-green-300 rounded-md">
                    <p className="text-sm font-medium text-green-800">
                        ✅ Task completed! Field has been auto-populated with the result.
                    </p>
                </div>
            )}

            {/* Extraction error state */}
            {extractionError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-medium text-red-800">
                        ⚠️ Result Processing Error
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                        {extractionError}
                    </p>
                </div>
            )}

            {/* Task failure display */}
            {task && task.status === 'Failed' && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-medium text-red-800">
                        ❌ Task Failed
                    </p>
                    {task.errorMessage && (
                        <p className="text-xs text-red-700 mt-1">{task.errorMessage}</p>
                    )}
                    <button
                        onClick={() => {
                            setTaskId(null);
                            setTask(null);
                            setExtractionError(null);
                        }}
                        className="mt-2 text-xs px-2 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Button to create in Minecraft (disabled if already set or in progress) */}
            {!value && !taskId && (
                <button
                    onClick={handleCreateInMinecraft}
                    disabled={isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                >
                    {isLoading ? 'Creating task...' : 'Send to Minecraft'}
                </button>
            )}

            {/* Existing region selector (optional) */}
            {allowExisting && !value && !taskId && (
                <select
                    onChange={e => onChange(e.target.value || null)}
                    className="block w-full mt-2 border-gray-300 rounded-md"
                >
                    <option value="">Or select existing region...</option>
                    {/* TODO: Fetch existing regions from API */}
                </select>
            )}
        </div>
    );
};
