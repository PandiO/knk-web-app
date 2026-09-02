import React, { useEffect, useState, useRef } from 'react';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import { WorldTaskReadDto } from '../../types/dtos/workflow/WorkflowDtos';
import { FormFieldDto, FormConfigurationDto } from '../../types/dtos/forms/FormModels';
import { FieldValidationRuleDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { Copy, Check, MapPin } from 'lucide-react';
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
    /** ID of the entity being edited by this wizard, if it has already been saved. Required for headless tasks that operate on an existing row (e.g. GateBlockScan). */
    entityId?: string | number;
    preResolvedPlaceholders?: Record<string, string>; // Phase 5.2: Pre-resolved placeholders from validation rules
    formConfiguration?: FormConfigurationDto; // Phase 7: Form configuration for dependency resolution context
    validationRules?: FieldValidationRuleDto[]; // Phase 7: Validation rules for current field
    currentFormValues?: Record<string, any>; // Phase 7: Current form values for validation context
    onTaskCompleted?: (task: WorldTaskReadDto, extractedValue: any) => void;
    showLabel?: boolean;
    hidePrimaryActionButton?: boolean;
    actionButtonId?: string;
    onStatusBannerVisibilityChange?: (visible: boolean) => void;
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

const getNormalizedStatus = (status?: string): string => (status || '').toLowerCase();

const hasExtractedValue = (value: unknown): boolean => value !== null && value !== undefined;

/**
 * Task types that are executed by the plugin without a player and therefore never
 * produce a claim code. The webapp shows scan progress instead of a "send to Minecraft" prompt.
 */
const HEADLESS_TASK_TYPES = ['GateBlockScan'];

export function isHeadlessTaskType(taskType?: string, actualTaskType?: string): boolean {
    return HEADLESS_TASK_TYPES.includes(taskType || '') || HEADLESS_TASK_TYPES.includes(actualTaskType || '');
}

function getScanWarnings(task: WorldTaskReadDto): string[] {
    if (!task.outputJson) return [];
    try {
        const parsed = JSON.parse(task.outputJson);
        const warnings = parsed?.warnings;
        return Array.isArray(warnings) ? warnings.filter((entry): entry is string => typeof entry === 'string') : [];
    } catch {
        return [];
    }
}

export interface WorldTaskResultDetail {
    label: string;
    value: string;
}

const getOutputValueByKey = (output: Record<string, any>, key: string): any => {
    if (Object.prototype.hasOwnProperty.call(output, key)) {
        return output[key];
    }

    const matchedKey = Object.keys(output).find(existingKey => existingKey.toLowerCase() === key.toLowerCase());
    return matchedKey ? output[matchedKey] : undefined;
};

const formatDecimal = (value: unknown): string => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(value);
};

const formatResultLabel = (key: string): string =>
    key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, character => character.toUpperCase());

const formatResultValue = (value: unknown): string => {
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
};

export function getWorldTaskResultDetails(task: WorldTaskReadDto, taskType: string): WorldTaskResultDetail[] {
    if (!task.outputJson) return [];

    try {
        const parsedOutput = JSON.parse(task.outputJson);
        const output = parsedOutput && typeof parsedOutput === 'object'
            ? parsedOutput as Record<string, any>
            : {};

        if (isGateBlockScanTask(taskType, task.taskType) && output.status !== undefined) {
            const details: WorldTaskResultDetail[] = [
                { label: 'Status', value: String(output.status) },
                { label: 'Blocks scanned', value: String(output.blockCount ?? 0) }
            ];
            const warningCount = Array.isArray(output.warnings) ? output.warnings.length : 0;
            if (warningCount > 0) {
                details.push({ label: 'Warnings', value: String(warningCount) });
            }
            return details;
        }

        if (isLocationTask(taskType, task.taskType) &&
            output.x !== undefined && output.y !== undefined && output.z !== undefined) {
            const details: WorldTaskResultDetail[] = [];
            const name = getOutputValueByKey(output, 'name');
            const world = getOutputValueByKey(output, 'world') ?? getOutputValueByKey(output, 'worldName');

            if (hasExtractedValue(name)) {
                details.push({ label: 'Name', value: String(name) });
            }
            details.push({
                label: 'Position',
                value: `(${formatDecimal(output.x)}, ${formatDecimal(output.y)}, ${formatDecimal(output.z)})`
            });
            if (output.yaw !== undefined || output.pitch !== undefined) {
                details.push({
                    label: 'Rotation',
                    value: `yaw=${formatDecimal(output.yaw ?? 0)}, pitch=${formatDecimal(output.pitch ?? 0)}`
                });
            }
            if (hasExtractedValue(world)) {
                details.push({ label: 'World', value: String(world) });
            }

            return details;
        }

        const regionId = getOutputValueByKey(output, 'regionId');
        if (hasExtractedValue(regionId)) {
            const details: WorldTaskResultDetail[] = [
                { label: 'Region ID', value: String(regionId) }
            ];
            const world = getOutputValueByKey(output, 'worldName') ?? getOutputValueByKey(output, 'world');
            const parentRegionId = getOutputValueByKey(output, 'parentRegionId');

            if (hasExtractedValue(world)) {
                details.push({ label: 'World', value: String(world) });
            }
            if (hasExtractedValue(parentRegionId)) {
                details.push({ label: 'Parent region', value: String(parentRegionId) });
            }

            return details;
        }

        const hiddenKeys = new Set(['fieldname', 'capturedat', 'createdat']);
        return Object.entries(output)
            .filter(([key, resultValue]) => !hiddenKeys.has(key.toLowerCase()) && hasExtractedValue(resultValue))
            .map(([key, resultValue]) => ({
                label: formatResultLabel(key),
                value: formatResultValue(resultValue)
            }));
    } catch {
        return [];
    }
}

export const WorldTaskResultDetails: React.FC<{ details: WorldTaskResultDetail[] }> = ({ details }) => {
    if (details.length === 0) return null;

    return (
        <div className="mt-3 border-t border-green-200 pt-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-green-900">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>Minecraft result</span>
            </div>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                {details.map(detail => (
                    <React.Fragment key={detail.label}>
                        <dt className="font-medium text-green-700">{detail.label}</dt>
                        <dd className="min-w-0 break-words font-mono text-green-950">{detail.value}</dd>
                    </React.Fragment>
                ))}
            </dl>
        </div>
    );
};

/**
 * Extracts the result value from a completed WorldTask's outputJson
 * For Location tasks, converts raw coordinates to location object
 * For Region tasks, extracts the regionId directly
 */
function extractTaskResult(task: WorldTaskReadDto, taskType: string): any {
    if (!task.outputJson) return null;
    
    try {
        const parsedOutput = JSON.parse(task.outputJson);
        const output = parsedOutput && typeof parsedOutput === 'object' ? parsedOutput as Record<string, any> : {};

        // GateBlockScan: snapshots are already persisted server-side; the field only needs a
        // small summary so "already scanned" state survives a saved/resumed draft.
        if (isGateBlockScanTask(taskType, task.taskType) && output.status !== undefined) {
            return {
                status: output.status,
                blockCount: output.blockCount ?? 0,
                scannedAt: new Date().toISOString()
            };
        }

        // Special handling for Location tasks
        if (isLocationTask(taskType, task.taskType)) {
            // Extract raw location data and convert to location object
            if (output.x !== undefined && output.y !== undefined && output.z !== undefined) {
                const locationObject = {
                    name: output.name ?? 'Location',
                    x: output.x,
                    y: output.y,
                    z: output.z,
                    yaw: output.yaw ?? 0,
                    pitch: output.pitch ?? 0,
                    World: output.World ?? output.worldName ?? 'world'
                };
                console.log('Extracted location from task:', locationObject);
                return locationObject;
            }
        }
        
        // Use task-type mapping to find the correct field
        const expectedFieldName = TASK_OUTPUT_FIELD_MAP[taskType] || 
                                 TASK_OUTPUT_FIELD_MAP[task.taskType] ||
                                 null;
        
        if (expectedFieldName && expectedFieldName !== 'location') {
            const mappedValue = getOutputValueByKey(output, expectedFieldName);
            if (hasExtractedValue(mappedValue)) {
                return mappedValue;
            }
        }
        
        // Fallback: try common result field names
        const fallbackKeys = ['regionId', 'structureId', 'value', 'result', 'id'];
        for (const key of fallbackKeys) {
            const fallbackValue = getOutputValueByKey(output, key);
            if (hasExtractedValue(fallbackValue)) {
                return fallbackValue;
            }
        }

        return null;
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

function isGateBlockScanTask(taskType: string, actualTaskType?: string): boolean {
    return taskType === 'GateBlockScan' || actualTaskType === 'GateBlockScan';
}

export function shouldShowWorldTaskResultDetails(task: WorldTaskReadDto, taskType: string): boolean {
    return !isLocationTask(taskType, task.taskType);
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
    entityId,
    preResolvedPlaceholders,
    formConfiguration,
    validationRules,
    currentFormValues,
    onTaskCompleted,
    showLabel = true,
    hidePrimaryActionButton = false,
    actionButtonId,
    onStatusBannerVisibilityChange,
}) => {
    const [taskId, setTaskId] = useState<number | null>(null);
    const [task, setTask] = useState<WorldTaskReadDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [extractionSucceeded, setExtractionSucceeded] = useState(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const onChangeRef = useRef(onChange);
    const onTaskCompletedRef = useRef(onTaskCompleted);
    const isReadOnlyRef = useRef(!!field.isReadOnly);
    
    // Keep polling interval stable across parent re-renders
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onTaskCompletedRef.current = onTaskCompleted;
    }, [onTaskCompleted]);

    useEffect(() => {
        isReadOnlyRef.current = !!field.isReadOnly;
    }, [field.isReadOnly]);

    // Phase 7: Use enriched form context for dependency resolution
    // NOTE: Hook must be called unconditionally per React rules
    const formContext = useEnrichedFormContext(formConfiguration || {} as any);

    // Poll task status when taskId is set
    useEffect(() => {
        // Don't start polling when task is not active or already completed locally
        if (field.isReadOnly || !taskId || extractionSucceeded) {
            return;
        }

        // Prevent duplicate intervals for the same active task
        if (pollingIntervalRef.current) {
            return;
        }

        console.log('Starting task status polling for taskId:', taskId);

        const pollInterval = setInterval(async () => {
            try {
                console.log('Polling status for WorldTask ID:', taskId);
                const updated = await worldTaskClient.getById(taskId);
                setTask(updated);
                const updatedStatus = getNormalizedStatus(updated.status);

                // If task completed, extract output and bind to field
                if (updatedStatus === 'completed' && updated.outputJson) {
                    console.log('WorldTask completed, extracting result:', updated);
                    // Use the task's actual taskType for extraction (not the prop)
                    const extractedValue = extractTaskResult(updated, updated.taskType || taskType);
                    
                    if (hasExtractedValue(extractedValue) && !isReadOnlyRef.current) {
                        // Update field value
                        onChangeRef.current(extractedValue);
                        setExtractionSucceeded(true);
                        setExtractionError(null);
                        
                        // Notify parent about successful completion
                        if (onTaskCompletedRef.current) {
                            onTaskCompletedRef.current(updated, extractedValue);
                        }
                        
                        console.log(`✓ WorldTask ${taskId} result extracted and field populated:`, extractedValue);
                        clearInterval(pollInterval);
                        pollingIntervalRef.current = null;
                    } else {
                        setExtractionError('Could not extract result from task output');
                        console.warn(`WorldTask ${taskId} completed but no result value found in output`);
                        clearInterval(pollInterval);
                        pollingIntervalRef.current = null;
                    }
                }

                if (updatedStatus === 'completed' && !updated.outputJson) {
                    setExtractionError('Task completed but no output was returned.');
                    clearInterval(pollInterval);
                    pollingIntervalRef.current = null;
                }

                // If task failed, show error and stop polling
                if (updatedStatus === 'failed') {
                    setExtractionError(updated.errorMessage || 'Task failed in Minecraft');
                    console.error('WorldTask failed:', updated.errorMessage);
                    clearInterval(pollInterval);
                    pollingIntervalRef.current = null;
                }
            } catch (error) {
                console.error('Failed to poll task status:', error);
            }
        }, 2000);  // Poll every 2 seconds

        pollingIntervalRef.current = pollInterval;

        return () => {
            clearInterval(pollInterval);
            pollingIntervalRef.current = null;
        };
    }, [taskId, extractionSucceeded, taskType, field.isReadOnly]);

    const handleCreateInMinecraft = async () => {
        if (isReadOnlyRef.current) return;

        const isGateBlockScan = taskType === 'GateBlockScan';
        if (isGateBlockScan && !entityId) {
            console.warn('Cannot start GateBlockScan: entity has not been saved yet, no gateStructureId available.');
            return;
        }

        setIsLoading(true);
        try {
            if (isGateBlockScan) {
                const created = await worldTaskClient.create({
                    workflowSessionId,
                    stepNumber,
                    stepKey: stepKey || field.formStepId || 'unknown',
                    fieldName: field.fieldName,
                    taskType,
                    inputJson: JSON.stringify({ gateStructureId: Number(entityId) }),
                });

                setTask(created);
                setTaskId(created.id);
                return;
            }

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
                // Enrich validation rules with dependency values from form
                const enrichedRules = validationRules?.map(rule => {
                    const enriched: any = { ...rule };
                    
                    // Get dependency field name and look up its value
                    const depFieldName = rule.dependsOnField?.fieldName || rule.dependencyPath;
                    if (depFieldName && currentFormValues) {
                        // For simple fields, use the field name directly
                        // For multi-layer paths like "Town.WgRegionId", use the last segment
                        const fieldName = depFieldName.includes('.') 
                            ? depFieldName.split('.').pop() 
                            : depFieldName;
                        enriched.dependencyFieldValue = currentFormValues[fieldName || ''];
                    }
                    
                    return enriched;
                }) || [];

                const validationContext = {
                    formContextValues: currentFormValues || formContext.values, // Use provided form values or hook values
                    resolvedDependencies: Array.from(formContext.resolvedDependencies.values()),
                    entityMetadata: Array.from(formContext.entityMetadata.values()),
                    validationRules: enrichedRules, // Include enriched validation rules for plugin
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

    const handleCopyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(text);
            setTimeout(() => setCopiedText(null), 2000);
        } catch (error) {
            console.error('Failed to copy text:', error);
        }
    };

    const handleRunAgain = () => {
        setTaskId(null);
        setTask(null);
        setExtractionSucceeded(false);
        setExtractionError(null);
    };

    const taskStatus = getNormalizedStatus(task?.status);
    const isHeadless = isHeadlessTaskType(taskType, task?.taskType);
    const gateScanBlocked = taskType === 'GateBlockScan' && !entityId;
    const scanWarnings = task && taskStatus === 'completed' ? getScanWarnings(task) : [];
    const resultDetails = task && taskStatus === 'completed'
        ? getWorldTaskResultDetails(task, task.taskType || taskType)
        : [];
    const showResultDetails = task
        ? shouldShowWorldTaskResultDetails(task, taskType)
        : false;

    const hasVisibleStatusBanner =
        (!!task && taskStatus === 'pending' && (!!task.linkCode || isHeadless)) ||
        (!!task && (taskStatus === 'inprogress' || taskStatus === 'accepted')) ||
        (!!task && taskStatus === 'completed' && !extractionSucceeded && !extractionError) ||
        (!!task && taskStatus === 'completed' && extractionSucceeded) ||
        !!extractionError ||
        (!!task && taskStatus === 'failed');

    useEffect(() => {
        onStatusBannerVisibilityChange?.(hasVisibleStatusBanner);
    }, [hasVisibleStatusBanner, onStatusBannerVisibilityChange]);

    return (
        <div className="mb-4">
            {showLabel && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Prominent claim code display for Pending tasks (player-driven only) */}
            {task && taskStatus === 'pending' && task.linkCode && !isHeadless && (
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
                                        onClick={() => handleCopyText(task.linkCode!)}
                                        className="p-2 hover:bg-yellow-100 rounded transition-colors"
                                        title="Copy claim code"
                                    >
                                        {copiedText === task.linkCode ? (
                                            <Check className="h-5 w-5 text-green-600" />
                                        ) : (
                                            <Copy className="h-5 w-5 text-gray-600 hover:text-gray-900" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-gray-800 p-3 rounded-md">
                                <p className="text-xs text-gray-400 mb-1">In Minecraft, type:</p>
                                <div className="flex items-center justify-between gap-2">
                                    <code className="min-w-0 break-all text-sm font-mono text-green-400">
                                        /knk task-claim {task.linkCode}
                                    </code>
                                    <button
                                        onClick={() => handleCopyText(`/knk task-claim ${task.linkCode}`)}
                                        className="shrink-0 p-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded transition-colors"
                                        title="Copy Minecraft command"
                                    >
                                        {copiedText === `/knk task-claim ${task.linkCode}` ? (
                                            <Check className="h-5 w-5 text-green-400" />
                                        ) : (
                                            <Copy className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-yellow-700 mt-2">
                                💡 This code links your web session to your in-game actions
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress indicator for headless (no-player) tasks, e.g. GateBlockScan */}
            {task && taskStatus === 'pending' && isHeadless && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" aria-hidden="true" />
                        <p className="text-sm font-medium text-blue-800">Scanning in progress on the server…</p>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                        No in-game action is needed; this runs automatically and may take a moment for large areas.
                    </p>
                </div>
            )}

            {/* Task in-progress state with claim info */}
            {task && (taskStatus === 'inprogress' || taskStatus === 'accepted') && (
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
            {task && taskStatus === 'completed' && !extractionSucceeded && !extractionError && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                        ⏳ Processing task result...
                    </p>
                </div>
            )}

            {/* Task completion success state */}
            {task && taskStatus === 'completed' && extractionSucceeded && (
                <div className="mb-3 p-3 bg-green-50 border border-green-300 rounded-md">
                    <p className="text-sm font-medium text-green-800">
                        ✅ Task completed! Field has been auto-populated with the result.
                    </p>
                    {showResultDetails && <WorldTaskResultDetails details={resultDetails} />}
                    {scanWarnings.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-yellow-800">
                            {scanWarnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                            ))}
                        </ul>
                    )}
                    {!field.isReadOnly && (
                        <button
                            onClick={handleRunAgain}
                            className="mt-2 text-xs px-2 py-1 bg-green-200 text-green-800 rounded hover:bg-green-300"
                        >
                            Capture again
                        </button>
                    )}
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
            {task && taskStatus === 'failed' && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-medium text-red-800">
                        ❌ Task Failed
                    </p>
                    {task.errorMessage && (
                        <p className="text-xs text-red-700 mt-1">{task.errorMessage}</p>
                    )}
                    {!field.isReadOnly && (
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
                    )}
                </div>
            )}

            {/* Cached scan summary from a previous run (survives saved/resumed drafts) */}
            {!task && !taskId && taskType === 'GateBlockScan' && value?.status && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-gray-700">
                        Previously scanned: <strong>{value.blockCount ?? 0} blocks</strong> ({value.status})
                    </p>
                </div>
            )}

            {/* Button to create in Minecraft */}
            {gateScanBlocked && !field.isReadOnly && !taskId && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                    Save the gate first; scanning needs an existing gate ID.
                </p>
            )}
            {allowCreate && !field.isReadOnly && !taskId && !gateScanBlocked && (
                <button
                    id={actionButtonId}
                    onClick={handleCreateInMinecraft}
                    disabled={isLoading}
                    className={hidePrimaryActionButton ? 'hidden' : 'px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400'}
                >
                    {isHeadlessTaskType(taskType)
                        ? (isLoading ? 'Starting scan...' : (value ? 'Re-scan' : 'Start scan'))
                        : (isLoading ? 'Creating task...' : (value ? 'Replace via Minecraft' : 'Send to Minecraft'))}
                </button>
            )}

            {/* Existing region selector (optional) */}
            {allowExisting && !taskId && (
                <select
                    onChange={e => onChange(e.target.value || null)}
                    disabled={field.isReadOnly}
                    className="block w-full mt-2 border-gray-300 rounded-md"
                >
                    <option value="">Or select existing region...</option>
                    {/* TODO: Fetch existing regions from API */}
                </select>
            )}
        </div>
    );
};
