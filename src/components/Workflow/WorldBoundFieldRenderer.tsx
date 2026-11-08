import React, { useEffect, useState, useRef } from 'react';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import {
    OnlineStaffDto,
    WorldTaskActiveForMeDto,
    WorldTaskDelivery,
    WorldTaskReadDto,
    WorldTaskUpdatedPayload,
} from '../../types/dtos/workflow/WorkflowDtos';
import { useRealtime, useRealtimeEvent, useRealtimeReconnected } from '../../realtime/RealtimeProvider';
import { FormFieldDto, FormConfigurationDto } from '../../types/dtos/forms/FormModels';
import { FieldValidationRuleDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { Copy, Check, MapPin } from 'lucide-react';
import { useEnrichedFormContext } from '../../hooks/useEnrichedFormContext';
import { resolveWorldTaskDependencyValue } from '../../utils/forms/worldTaskDependency';
import { keepLocationIdOnReplace } from '../../utils/forms/worldTaskFieldValue';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import {
    isClosedWorldTask,
    isOpenWorldTask,
    needsApplying,
    taskCodeCommand,
} from '../../utils/forms/worldTaskLifecycle';

/**
 * PandiO/knk-workspace#181 (DESIGN §8.5): how often an open task is re-read. While the web hub is connected the panel
 * renders from WorldTaskUpdated and this is only a safety net; while it is not (or realtime is off) the poll is the
 * #180 one, unchanged.
 */
export const TASK_POLL_MS_DISCONNECTED = 2000;
export const TASK_POLL_MS_CONNECTED = 10000;

/** #181: a WorldTaskUpdated payload over the task the panel holds (the output is read with GET once Completed). */
export function mergeTaskUpdate(task: WorldTaskReadDto, update: WorldTaskUpdatedPayload): WorldTaskReadDto {
    return {
        ...task,
        status: update.status ?? task.status,
        offerState: update.offerState ?? task.offerState,
        targetUserId: update.targetUserId ?? task.targetUserId,
        targetUsername: update.targetUsername ?? task.targetUsername,
        claimedByMinecraftUsername: update.claimedByMinecraftUsername ?? undefined,
        claimedByServerId: update.claimedByServerId ?? undefined,
        errorMessage: update.errorMessage ?? undefined,
        expiresAt: update.expiresAt ?? task.expiresAt,
        offeredAt: update.offeredAt ?? task.offeredAt,
        releaseCount: update.releaseCount ?? task.releaseCount,
    };
}

/** #181: the line above the task code for a waiting task, by its offer state (DESIGN §8.3). */
export function offerNotice(task: WorldTaskReadDto): string | null {
    const who = task.targetUsername || 'the player';
    const handOff = task.targetUserId !== undefined && task.targetUserId !== null
        && task.createdByUserId !== undefined && task.targetUserId !== task.createdByUserId;
    switch (task.offerState) {
        case 'Offered':
            return handOff
                ? `Sent to ${who} in game, waiting for Accept or Decline (2 min)…`
                : 'Sent to you in game…';
        case 'Queued':
            return 'Queued: it is sent to you in game when your current task ends.';
        case 'Declined':
            return handOff ? `${who} declined it in game (or wasn't online). Use the task code.` : 'It could not be sent to you in game. Use the task code.';
        case 'TimedOut':
            return handOff ? `No answer from ${who} in game. Use the task code.` : 'No answer from the game server. Use the task code.';
        case 'Busy':
            return 'You already had a task open in game when this one arrived. Finish that one, then use the task code (or Start again).';
        case 'NoPermission':
            // #239: the game server refused it: the player lacks knk.tasks in game.
            return handOff
                ? `${who} doesn't have world-task access in game (knk.tasks). Hand it to someone else or use the task code.`
                : "You don't have world-task access in game (knk.tasks). Use the task code, or hand it off.";
        default:
            return null;
    }
}

/** PandiO/knk-workspace#180: where a new task belongs (the draft is saved silently first if there is none, Q19). */
export interface WorldTaskAnchor {
    workflowSessionId: number;
    formSubmissionProgressId?: number;
}

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
    /**
     * PandiO/knk-workspace#180 (DESIGN §8.7): the field's latest task as the form knows it (from the draft on resume, or
     * from earlier in this visit after a step change). The panel reattaches to it: an open task is followed again, a
     * completed one that is not in the draft yet fills the field.
     */
    initialTask?: WorldTaskReadDto | null;
    /** #180: every change of this field's task (null when the panel was reset), so the form can keep it across steps. */
    onTaskChange?: (task: WorldTaskReadDto | null) => void;
    /** #180: called before a task is created: saves the draft silently if none exists and returns where the task belongs. */
    ensureTaskAnchor?: () => Promise<WorldTaskAnchor | null>;
    /** #180: a completed result was written into the form; the form saves the draft and marks the task applied. */
    onResultApplied?: (task: WorldTaskReadDto) => void;
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

// ItemScan's output (docs/specs/items/IMPLEMENTATION_PLAN.md §5.2) has no single mapped field -
// its material/displayName/lore/enchantments each land on a different ItemBlueprint field, which
// FormWizard.tsx's onTaskCompleted handles (not this generic map). extractTaskResult below has
// its own dedicated branch (isItemScanTask), the same pattern GateBlockScan already established.

const getNormalizedStatus = (status?: string): string => (status || '').toLowerCase();

const hasExtractedValue = (value: unknown): boolean => value !== null && value !== undefined;

/**
 * GateBlockScan and its sibling GateOpenedBlockScan (docs/features/gate-structure-animation/
 * ROTATION_GAP_FILL_DESIGN.md, Mechanism 2 - scans a gate's separately-built open state instead
 * of its closed one) share identical scan-progress UI: same output shape (status/blockCount/
 * warnings), same headless (no-player) execution model. Grouped here so both get the same
 * treatment everywhere this file branches on "is this a gate block scan task".
 */
const GATE_BLOCK_SCAN_TASK_TYPES = ['GateBlockScan', 'GateOpenedBlockScan'];

const ITEM_SCAN_TASK_TYPE = 'ItemScan';

// KitScan (docs/specs/kits/DESIGN.md §6) - player-driven like ItemScan, so also not headless
// (§6.6). Its output fills many Kit fields at once (six equipment pickers plus the Contents M2M
// step), which FormWizard.tsx's applyKitScanResult does from onTaskCompleted - so unlike every
// other task type, a KitScan never writes an extracted value into its own bound field.
const KIT_SCAN_TASK_TYPE = 'KitScan';

/**
 * Task types that are executed by the plugin without a player and therefore never
 * produce a task code. The webapp shows scan progress instead of a "send to Minecraft" prompt.
 *
 * ItemScan is deliberately NOT here (docs/specs/items/IMPLEMENTATION_PLAN.md §5.1/§5.3) - it's
 * player-driven (a specific player must be holding the item at scan time), so it needs the
 * normal claim-code banner Location/WgRegionId already get, not the headless progress spinner.
 * KitScan is deliberately NOT here either, for the same reason (docs/specs/kits/DESIGN.md §6.6).
 */
const HEADLESS_TASK_TYPES = [...GATE_BLOCK_SCAN_TASK_TYPES];

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

        if (isKitScanTask(taskType, task.taskType) && output.status !== undefined) {
            const equipmentKeys = ['helmet', 'chestplate', 'leggings', 'boots', 'shield', 'hand'];
            const equipmentCount = equipmentKeys.filter(key => hasExtractedValue(output[key])).length;
            const contentCount = Array.isArray(output.contents) ? output.contents.length : 0;
            const details: WorldTaskResultDetail[] = [
                { label: 'Status', value: String(output.status) },
                { label: 'Equipment slots', value: String(equipmentCount) },
                { label: 'Inventory slots', value: String(contentCount) }
            ];
            const warningCount = Array.isArray(output.warnings) ? output.warnings.length : 0;
            if (warningCount > 0) {
                details.push({ label: 'Warnings', value: String(warningCount) });
            }
            return details;
        }

        if (isItemScanTask(taskType, task.taskType) && output.status !== undefined) {
            const details: WorldTaskResultDetail[] = [
                { label: 'Status', value: String(output.status) },
                { label: 'Material', value: String(output.material ?? 'unknown') }
            ];
            if (hasExtractedValue(output.displayName)) {
                details.push({ label: 'Name', value: String(output.displayName) });
            }
            const vanillaCount = Array.isArray(output.vanillaEnchantments) ? output.vanillaEnchantments.length : 0;
            const customCount = Array.isArray(output.customEnchantments) ? output.customEnchantments.length : 0;
            if (vanillaCount + customCount > 0) {
                details.push({ label: 'Enchantments found', value: String(vanillaCount + customCount) });
            }
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
        <div className="mt-3 border-t border-success-line pt-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-green-900">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>Minecraft result</span>
            </div>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                {details.map(detail => (
                    <React.Fragment key={detail.label}>
                        <dt className="font-medium text-success">{detail.label}</dt>
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
export function extractTaskResult(task: WorldTaskReadDto, taskType: string): any {
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

        // ItemScan (docs/specs/items/IMPLEMENTATION_PLAN.md §5.2/§5.3): ItemBlueprint has no
        // dedicated "scan result" field the way GateDoor has BlockSnapshots (a real persisted
        // collection) - FormTemplateValidationService rejects a FormField whose fieldName isn't a
        // real entity property, so the WorldTask panel is bound directly onto the real
        // DefaultDisplayName field instead of a phantom one (live-authored design decision, see
        // ACTIVE_SESSIONS.md's Items Phase 4/5 row). This field's own extracted value is
        // therefore just the scanned display name itself, exactly like any other WorldTask-bound
        // String field - the material/lore/enchantment fan-out onto the *other* ItemBlueprint
        // fields happens separately, in FormWizard.tsx's onTaskCompleted handler, from this same
        // task's outputJson.
        if (isItemScanTask(taskType, task.taskType) && output.status !== undefined) {
            // Most scanned items have no custom display name (ItemMeta.hasDisplayName() is
            // false for anything never renamed) - falling back to '' rather than null/undefined
            // keeps hasExtractedValue() true so this is a normal, silent "nothing to fill in"
            // result rather than a spurious extraction-error banner on the common case.
            return typeof output.displayName === 'string' ? output.displayName : '';
        }

        // KitScan: the bound field itself gets nothing (see the polling effect below) - this only
        // needs to be non-null so a completed scan counts as a successful extraction and
        // onTaskCompleted fires.
        if (isKitScanTask(taskType, task.taskType) && output.status !== undefined) {
            return String(output.status);
        }

        // Special handling for Location tasks
        if (isLocationTask(taskType, task.taskType)) {
            // Extract raw location data and convert to location object
            if (output.x !== undefined && output.y !== undefined && output.z !== undefined) {
                // KNG-118 (U2): no silent 'world' default. A capture without a world is refused
                // (the extraction-error banner shows) instead of saving a Location in a world named "world".
                const world = getOutputValueByKey(output, 'world') ?? getOutputValueByKey(output, 'worldName');
                if (typeof world !== 'string' || world.trim() === '') {
                    console.warn('Location task output has no world; not using it:', output);
                    return null;
                }
                const locationObject = {
                    name: output.name ?? 'Location',
                    x: output.x,
                    y: output.y,
                    z: output.z,
                    yaw: output.yaw ?? 0,
                    pitch: output.pitch ?? 0,
                    World: world.trim()
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
    return GATE_BLOCK_SCAN_TASK_TYPES.includes(taskType) || GATE_BLOCK_SCAN_TASK_TYPES.includes(actualTaskType || '');
}

function isItemScanTask(taskType: string, actualTaskType?: string): boolean {
    return taskType === ITEM_SCAN_TASK_TYPE || actualTaskType === ITEM_SCAN_TASK_TYPE;
}

function isKitScanTask(taskType: string, actualTaskType?: string): boolean {
    return taskType === KIT_SCAN_TASK_TYPE || actualTaskType === KIT_SCAN_TASK_TYPE;
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
    initialTask,
    onTaskChange,
    ensureTaskAnchor,
    onResultApplied,
}) => {
    const [taskId, setTaskId] = useState<number | null>(null);
    const [task, setTask] = useState<WorldTaskReadDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [extractionSucceeded, setExtractionSucceeded] = useState(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    // KNG-268: why the API refused to create the task (e.g. a region door without its captured region).
    const [createError, setCreateError] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const onChangeRef = useRef(onChange);
    // The value the field holds right now, for the polling closure (KNG-134: Replace keeps the id).
    const valueRef = useRef(value);
    valueRef.current = value;
    const onTaskCompletedRef = useRef(onTaskCompleted);
    const onTaskChangeRef = useRef(onTaskChange);
    onTaskChangeRef.current = onTaskChange;
    const onResultAppliedRef = useRef(onResultApplied);
    onResultAppliedRef.current = onResultApplied;
    const isReadOnlyRef = useRef(!!field.isReadOnly);
    const taskTypeRef = useRef(taskType);
    taskTypeRef.current = taskType;

    // Keep polling interval stable across parent re-renders
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // #181 (DESIGN §8.3, §8.5): the web hub, the busy check, "Hand off to…" and the task code shown or folded away.
    const realtime = useRealtime();
    const [busy, setBusy] = useState<WorldTaskActiveForMeDto | null>(null);
    const [handOffOpen, setHandOffOpen] = useState(false);
    const [staff, setStaff] = useState<OnlineStaffDto[] | null>(null);
    const [staffError, setStaffError] = useState<string | null>(null);
    const [codeExpanded, setCodeExpanded] = useState(false);
    /** #240: why "Send again" didn't send (not online in game, or the API refused). */
    const [resendError, setResendError] = useState<string | null>(null);
    useEffect(() => {
        setResendError(null);
    }, [task?.id, task?.status, task?.offerState]);
    const taskRef = useRef<WorldTaskReadDto | null>(null);
    taskRef.current = task;
    const extractionSucceededRef = useRef(false);
    extractionSucceededRef.current = extractionSucceeded;

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

    /** #180: the task changed; the form keeps the latest per field (across steps and reloads). */
    const reportTask = (next: WorldTaskReadDto | null) => {
        onTaskChangeRef.current?.(next);
    };

    /**
     * A Completed task's result goes into the field (and, through onTaskCompleted, into the fields ItemScan/KitScan
     * fan out to). Returns whether a value was applied. #180: the form then saves the draft and marks the task applied.
     */
    const applyCompletedTask = (completed: WorldTaskReadDto): boolean => {
        const currentTaskType = taskTypeRef.current;
        if (!completed.outputJson) {
            setExtractionError('Task completed but no output was returned.');
            return false;
        }
        // Use the task's actual taskType for extraction (not the prop)
        const capturedValue = extractTaskResult(completed, completed.taskType || currentTaskType);
        // KNG-134: "Replace via Minecraft" on a Location that already has an id keeps it,
        // so the save updates that Location instead of creating a second one.
        const extractedValue = isLocationTask(currentTaskType, completed.taskType)
            ? keepLocationIdOnReplace(valueRef.current, capturedValue)
            : capturedValue;

        if (!hasExtractedValue(extractedValue) || isReadOnlyRef.current) {
            setExtractionError('Could not extract result from task output');
            return false;
        }
        // Update field value - except for KitScan, whose bound field is just an
        // anchor for the panel; applyKitScanResult (via onTaskCompleted) does
        // every Kit field write itself.
        if (!isKitScanTask(currentTaskType, completed.taskType)) {
            onChangeRef.current(extractedValue);
        }
        setExtractionSucceeded(true);
        setExtractionError(null);
        onTaskCompletedRef.current?.(completed, extractedValue);
        onResultAppliedRef.current?.(completed);
        // Marked applied locally at once, so a step change and back doesn't apply it twice.
        reportTask({ ...completed, appliedAt: completed.appliedAt ?? new Date().toISOString() });
        return true;
    };

    // #180 (DESIGN §8.7): reattach to the field's latest task when the panel mounts.
    useEffect(() => {
        if (!initialTask || field.isReadOnly) return;
        if (needsApplying(initialTask)) {
            setTask(initialTask);
            setTaskId(initialTask.id);
            applyCompletedTask(initialTask);
            return;
        }
        const status = getNormalizedStatus(initialTask.status);
        // Applied results are already in the field; a cancelled task (left the form, Capture again) is history.
        if (status === 'completed' || status === 'cancelled') return;
        setTask(initialTask);
        setTaskId(initialTask.id);
        // Only the mount (or a different task) reattaches; later changes come from this panel itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTask?.id]);

    /**
     * A fresh read of the task: shown, reported to the form, and a Completed result applied. Returns true when the task
     * is closed (stop following it). #180: Failed, Cancelled and Expired end the task; the banner offers "Start again".
     */
    const applyFetched = (updated: WorldTaskReadDto): boolean => {
        if (!updated) return false;
        setTask(updated);
        if (getNormalizedStatus(updated.status) === 'completed') {
            if (!extractionSucceededRef.current) {
                applyCompletedTask(updated);
            }
            return true;
        }
        reportTask(updated);
        return isClosedWorldTask(updated);
    };

    // Poll task status while the task is open
    useEffect(() => {
        // Don't start polling when task is not active or already completed locally
        if (field.isReadOnly || !taskId || extractionSucceeded || isClosedWorldTask(task)) {
            return;
        }

        // Prevent duplicate intervals for the same active task
        if (pollingIntervalRef.current) {
            return;
        }

        const stopPolling = () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };

        const pollInterval = setInterval(async () => {
            try {
                const updated = await worldTaskClient.getById(taskId);
                if (applyFetched(updated)) {
                    stopPolling();
                }
            } catch (error) {
                console.error('Failed to poll task status:', error);
            }
        }, realtime.connected ? TASK_POLL_MS_CONNECTED : TASK_POLL_MS_DISCONNECTED);

        pollingIntervalRef.current = pollInterval;

        return () => {
            clearInterval(pollInterval);
            pollingIntervalRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId, extractionSucceeded, taskType, field.isReadOnly, task?.status, realtime.connected]);

    // #181: follow this task over the web hub (joined again by the provider after a reconnect).
    useEffect(() => {
        if (field.isReadOnly || !taskId || !realtime.connected) return undefined;
        void realtime.joinTask(taskId);
        return () => realtime.leaveTask(taskId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId, realtime.connected, field.isReadOnly]);

    useRealtimeEvent<WorldTaskUpdatedPayload>('WorldTaskUpdated', (update) => {
        const current = taskRef.current;
        if (!update || !current || update.taskId !== current.id || field.isReadOnly || extractionSucceededRef.current) return;
        if (getNormalizedStatus(update.status) === 'completed') {
            // The output isn't in the event: read the task once and fill the field.
            void worldTaskClient.getById(current.id).then(applyFetched).catch(error =>
                console.error('Failed to read the completed world task:', error));
            return;
        }
        const merged = mergeTaskUpdate(current, update);
        setTask(merged);
        reportTask(merged);
    });

    // P2: after the hub was down, re-read what the panel shows.
    useRealtimeReconnected(() => {
        const current = taskRef.current;
        if (!current || field.isReadOnly || extractionSucceededRef.current || isClosedWorldTask(current)) return;
        void worldTaskClient.getById(current.id).then(applyFetched).catch(() => undefined);
    });

    /** #180: where the new task belongs; the form saves the draft first when there is none (silent, Q19). */
    const resolveAnchor = async (): Promise<WorldTaskAnchor> => {
        if (ensureTaskAnchor) {
            try {
                const anchor = await ensureTaskAnchor();
                if (anchor) return anchor;
            } catch (error) {
                console.error('Saving the draft for the world task failed; the task is not anchored to a draft:', error);
            }
        }
        return { workflowSessionId };
    };

    const startTracking = (created: WorldTaskReadDto) => {
        setTask(created);  // Set full task object immediately (includes the task code)
        setTaskId(created.id);  // Start polling for status updates
        reportTask(created);
    };

    const handleCreateInMinecraft = async (deliver?: WorldTaskDelivery) => {
        if (isReadOnlyRef.current) return;
        setBusy(null);
        setHandOffOpen(false);
        setCodeExpanded(false);

        const isGateBlockScan = GATE_BLOCK_SCAN_TASK_TYPES.includes(taskType);
        if (isGateBlockScan && !entityId) {
            console.warn(`Cannot start ${taskType}: entity has not been saved yet, no gateDoorId available.`);
            return;
        }

        setIsLoading(true);
        setCreateError(null);
        try {
            const anchor = await resolveAnchor();
            if (isGateBlockScan) {
                // Item 5 (docs/features/gate-structure-animation/
                // GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md) moved BlockSnapshots/
                // OpenedBlockSnapshots from GateStructure to GateDoor - a scan now targets one
                // door, not a whole structure, so this field only ever renders inside a GateDoor
                // form/step and entityId is already that door's own id.
                const created = await worldTaskClient.create({
                    workflowSessionId: anchor.workflowSessionId,
                    formSubmissionProgressId: anchor.formSubmissionProgressId,
                    stepNumber,
                    stepKey: stepKey || field.formStepId || 'unknown',
                    fieldName: field.fieldName,
                    taskType,
                    inputJson: JSON.stringify({ gateDoorId: Number(entityId) }),
                });

                startTracking(created);
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
                const enrichedRules = await Promise.all((validationRules ?? []).map(async rule => {
                    const enriched: any = { ...rule };

                    // Get dependency field name and look up its value
                    const depFieldName = rule.dependsOnField?.fieldName || rule.dependencyPath;
                    if (depFieldName && currentFormValues) {
                        // For simple fields, use the field name directly
                        // For multi-layer paths like "Town.WgRegionId", use the last segment
                        const fieldName = depFieldName.includes('.')
                            ? depFieldName.split('.').pop()
                            : depFieldName;
                        // KNG-131: an edit-loaded reference (e.g. an existing door's GateStructureId = 21)
                        // becomes the saved record, so the plugin can read its region.
                        enriched.dependencyFieldValue = await resolveWorldTaskDependencyValue(
                            rule, currentFormValues[fieldName || ''], formConfiguration);
                    }

                    return enriched;
                }));

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

            // Create world task via API (#180: a field's previous open task is cancelled by the API)
            const created = await worldTaskClient.create({
                workflowSessionId: anchor.workflowSessionId,
                formSubmissionProgressId: anchor.formSubmissionProgressId,
                stepNumber,
                stepKey: stepKey || field.formStepId || 'unknown',
                fieldName: field.fieldName,
                taskType: taskType,  // e.g., "WgRegionId"
                inputJson: JSON.stringify(inputData),
                // #181: omitted = the API's default, auto (offered to you when you are online in game, else the code)
                ...(deliver !== undefined ? { deliver } : {}),
            });

            startTracking(created);
        } catch (error) {
            console.error('Failed to create world task:', error);
            setCreateError(error instanceof Error && error.message ? error.message : 'The task could not be started.');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * #181 (DESIGN §8.3): "Send to Minecraft". With the web hub connected and you online in game, the busy check runs
     * first: if you already hold a task in game the panel asks Queue / Hand off / Replace / Cancel instead of sending
     * blindly. Otherwise (offline, realtime off, a scan) it sends as before; the API offers it to you or shows the code.
     */
    const handleSendToMinecraft = async () => {
        if (isReadOnlyRef.current) return;
        if (isHeadlessTaskType(taskType) || !realtime.connected) {
            await handleCreateInMinecraft();
            return;
        }
        setIsLoading(true);
        try {
            const [me, active] = await Promise.all([worldTaskClient.getMyPresence(), worldTaskClient.getActiveForMe()]);
            if (me?.online && active?.task) {
                setBusy(active);
                setIsLoading(false);
                return;
            }
        } catch (error) {
            // The busy check is a courtesy; the API checks again (Busy) and the task code always works.
            console.error('Busy check failed; sending anyway:', error);
        }
        setIsLoading(false);
        await handleCreateInMinecraft('auto');
    };

    /** #240: whether the open task can be sent again: waiting with its code, not offered right now, hub connected. */
    const canSendAgain = (): boolean => {
        const current = task;
        return !!current && !field.isReadOnly && realtime.connected && !!current.linkCode
            && getNormalizedStatus(current.status) === 'pending' && current.offerState !== 'Offered'
            && !isHeadlessTaskType(taskType, current.taskType);
    };

    /** #240: offers the waiting task again (POST {id}/offer) instead of creating a new one. */
    const offerAgain = async (deliver: Exclude<WorldTaskDelivery, 'code'>) => {
        if (!task || isReadOnlyRef.current) return;
        setBusy(null);
        setHandOffOpen(false);
        setCodeExpanded(false);
        setResendError(null);
        setIsLoading(true);
        try {
            const updated = await worldTaskClient.offer(task.id, deliver);
            setTask(updated);
            reportTask(updated);
        } catch (error) {
            console.error(`Failed to send world task ${task.id} again:`, error);
            setResendError(apiRefusalReason(error) ?? 'The task could not be sent again. Its task code still works.');
        } finally {
            setIsLoading(false);
        }
    };

    /** The busy panel and the hand-off picker: send the waiting task again (#240), else a new task (#181). */
    const deliverTask = (deliver: Exclude<WorldTaskDelivery, 'code'>) =>
        canSendAgain() ? offerAgain(deliver) : handleCreateInMinecraft(deliver);

    /** #240 "Send again": the same busy check as "Send to Minecraft", for the waiting task. */
    const handleSendAgain = async () => {
        if (!task || isReadOnlyRef.current) return;
        setResendError(null);
        setIsLoading(true);
        try {
            const [me, active] = await Promise.all([worldTaskClient.getMyPresence(), worldTaskClient.getActiveForMe()]);
            if (!me?.online) {
                setResendError("You're not online in game. Join the server and press Send again, or use the task code.");
                setIsLoading(false);
                return;
            }
            if (active?.task && active.task.id !== task.id) {
                setBusy(active);
                setIsLoading(false);
                return;
            }
        } catch (error) {
            // The checks are a courtesy; the API checks again.
            console.error('Busy check failed; sending anyway:', error);
        }
        setIsLoading(false);
        await offerAgain('auto');
    };

    /** #181: "Hand off to…": the online players with knk.tasks (Accept/Decline in game, 2 min). */
    const openHandOff = async () => {
        setHandOffOpen(true);
        setStaff(null);
        setStaffError(null);
        try {
            setStaff((await worldTaskClient.getOnlineStaff()) ?? []);
        } catch (error) {
            console.error('Failed to list online players:', error);
            setStaffError('Could not list who is online in game.');
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

    /** Back to the "Send to Minecraft" button. #180: an open task is cancelled first (Capture again / Try again). */
    const resetPanel = async (reason: string) => {
        const current = task;
        setTaskId(null);
        setTask(null);
        setExtractionSucceeded(false);
        setExtractionError(null);
        setCreateError(null);
        reportTask(null);
        if (current && isOpenWorldTask(current)) {
            try {
                await worldTaskClient.cancel(current.id, { reason });
            } catch (error) {
                console.error(`Failed to cancel world task ${current.id}:`, error);
            }
        }
    };

    const handleRunAgain = () => {
        void resetPanel('Capture again in the web app.');
    };

    /** #180: "Cancel task" on a waiting or claimed task (also the way out of a stuck InProgress). */
    const handleCancelTask = async () => {
        if (!task) return;
        setCancelling(true);
        try {
            const cancelled = await worldTaskClient.cancel(task.id, { reason: 'Cancelled in the web app.' });
            setTask(cancelled);
            reportTask(cancelled);
        } catch (error) {
            // 409: it moved on meanwhile (claimed, completed); show what it is now.
            try {
                const current = await worldTaskClient.getById(task.id);
                setTask(current);
                reportTask(current);
            } catch {
                console.error(`Failed to cancel world task ${task.id}:`, error);
            }
        } finally {
            setCancelling(false);
        }
    };

    const taskStatus = getNormalizedStatus(task?.status);
    const isHeadless = isHeadlessTaskType(taskType, task?.taskType);
    const gateScanBlocked = GATE_BLOCK_SCAN_TASK_TYPES.includes(taskType) && !entityId;
    const scanWarnings = task && taskStatus === 'completed' ? getScanWarnings(task) : [];
    const resultDetails = task && taskStatus === 'completed'
        ? getWorldTaskResultDetails(task, task.taskType || taskType)
        : [];
    const showResultDetails = task
        ? shouldShowWorldTaskResultDetails(task, taskType)
        : false;
    const taskCommand = task?.linkCode ? taskCodeCommand(task.linkCode) : '';
    // #181: while an offer is out, the task code is folded away (one click to show it, R5).
    const offerPending = !!task && taskStatus === 'pending' && task.offerState === 'Offered';
    const notice = task && taskStatus === 'pending' && !isHeadless ? offerNotice(task) : null;
    const showTaskCode = !!task && taskStatus === 'pending' && !!task.linkCode && !isHeadless && (!offerPending || codeExpanded);
    const expiresAtLabel = task?.expiresAt ? formatClockTime(task.expiresAt) : null;
    // #240: "Send again" / "Hand off to…" on a waiting task that fell back to its code.
    const sendAgainVisible = showTaskCode && canSendAgain();

    const hasVisibleStatusBanner =
        (!!task && taskStatus === 'pending' && (!!task.linkCode || isHeadless)) ||
        (!!task && (taskStatus === 'inprogress' || taskStatus === 'accepted')) ||
        (!!task && taskStatus === 'completed' && !extractionSucceeded && !extractionError) ||
        (!!task && taskStatus === 'completed' && extractionSucceeded) ||
        !!extractionError ||
        !!createError ||
        (!!task && (taskStatus === 'failed' || taskStatus === 'cancelled' || taskStatus === 'expired'));

    useEffect(() => {
        onStatusBannerVisibilityChange?.(hasVisibleStatusBanner);
    }, [hasVisibleStatusBanner, onStatusBannerVisibilityChange]);

    const cancelTaskButton = !field.isReadOnly && (
        <button
            type="button"
            onClick={handleCancelTask}
            disabled={cancelling}
            className="mt-2 text-xs px-2 py-1 border border-gray-300 bg-surface text-gray-700 rounded hover:bg-gray-100 disabled:opacity-50"
        >
            {cancelling ? 'Cancelling…' : 'Cancel task'}
        </button>
    );

    const startAgainButton = (label: string, tone: 'red' | 'gray') => !field.isReadOnly && (
        <button
            type="button"
            onClick={() => void resetPanel('Started again in the web app.')}
            className={tone === 'red'
                ? 'mt-2 text-xs px-2 py-1 bg-danger-line text-danger-strong rounded hover:bg-red-300'
                : 'mt-2 text-xs px-2 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300'}
        >
            {label}
        </button>
    );

    return (
        <div className="mb-4">
            {showLabel && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* #181: where the task went (offered, queued, declined, timed out, busy) */}
            {notice && (
                <div
                    className={offerPending
                        ? 'mb-3 p-3 bg-info-soft border border-info-line rounded-md'
                        : 'mb-3 p-3 bg-surface-alt border border-gray-300 rounded-md'}
                    role="status"
                >
                    <p className={offerPending ? 'text-sm font-medium text-info-strong' : 'text-sm text-gray-800'}>
                        {offerPending ? '📨 ' : ''}{notice}
                    </p>
                    {offerPending && task?.linkCode && (
                        <button
                            type="button"
                            onClick={() => setCodeExpanded(open => !open)}
                            className="mt-2 text-xs text-primary-dark underline hover:text-info-strong"
                            aria-expanded={codeExpanded}
                        >
                            {codeExpanded ? 'Hide the task code' : `Or use task code ${task.linkCode}`}
                        </button>
                    )}
                    {offerPending && !codeExpanded && cancelTaskButton}
                </div>
            )}

            {/* Prominent task code display for Pending tasks (player-driven only) */}
            {showTaskCode && task && (
                <div className="mb-4 p-4 bg-warning-soft border-2 border-yellow-400 rounded-lg shadow-sm">
                    <div className="flex items-start">
                        <span className="text-3xl mr-3">🎮</span>
                        <div className="flex-1">
                            <p className="text-lg font-bold text-warning-strong mb-2">
                                Ready for Minecraft!
                            </p>
                            {(task.releaseCount ?? 0) > 0 && (
                                <p className="text-xs text-warning-strong mb-2">
                                    The task was handed back in game; its task code works again.
                                </p>
                            )}
                            {/* #240: only the full command; people copy that, not the bare code */}
                            <div className="bg-gray-800 p-3 rounded-md">
                                <p className="text-xs text-muted mb-1">In Minecraft, type:</p>
                                <div className="flex items-center justify-between gap-2">
                                    <code className="min-w-0 break-all text-sm font-mono text-green-400">
                                        {taskCommand}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyText(taskCommand)}
                                        className="shrink-0 p-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded transition-colors"
                                        title="Copy Minecraft command"
                                    >
                                        {copiedText === taskCommand ? (
                                            <Check className="h-5 w-5 text-green-400" />
                                        ) : (
                                            <Copy className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-warning mt-2">
                                💡 This code links your web session to your in-game actions
                                {expiresAtLabel && <> · expires at {expiresAtLabel} if nobody claims it</>}
                            </p>
                            {sendAgainVisible && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleSendAgain()}
                                        disabled={isLoading}
                                        className="text-xs px-2 py-1 bg-success text-success-fg rounded hover:bg-success-strong disabled:bg-gray-400"
                                        title="Send this task to you in game again"
                                    >
                                        {isLoading ? 'Sending…' : 'Send again'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void openHandOff()}
                                        disabled={isLoading}
                                        className="text-xs px-2 py-1 border border-gray-300 bg-surface text-gray-700 rounded hover:bg-surface-alt disabled:opacity-50"
                                    >
                                        Hand off to…
                                    </button>
                                </div>
                            )}
                            {resendError && (
                                <p className="text-xs text-danger-strong mt-2" role="alert">{resendError}</p>
                            )}
                            {cancelTaskButton}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress indicator for headless (no-player) tasks, e.g. GateBlockScan */}
            {task && taskStatus === 'pending' && isHeadless && (
                <div className="mb-3 p-3 bg-info-soft border border-info-line rounded-md">
                    <div className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" aria-hidden="true" />
                        <p className="text-sm font-medium text-info-strong">Scanning in progress on the server…</p>
                    </div>
                    <p className="text-xs text-primary mt-1">
                        No in-game action is needed; this runs automatically and may take a moment for large areas.
                    </p>
                </div>
            )}

            {/* Task in-progress state with claim info */}
            {task && (taskStatus === 'inprogress' || taskStatus === 'accepted') && (
                <div className="mb-3 p-3 bg-info-soft border border-info-line rounded-md">
                    <p className="text-sm text-info-strong">
                        Task Status: <strong>{task.status}</strong>
                    </p>
                    {task.claimedByMinecraftUsername && (
                        <p className="text-xs text-primary-dark mt-1">
                            Claimed by: <strong>{task.claimedByMinecraftUsername}</strong>
                            {task.claimedByServerId && ` on ${task.claimedByServerId}`}
                        </p>
                    )}
                    <p className="text-xs text-primary mt-2">
                        Waiting for task to complete in Minecraft...
                    </p>
                    {cancelTaskButton}
                </div>
            )}

            {/* Task completion in progress state */}
            {task && taskStatus === 'completed' && !extractionSucceeded && !extractionError && (
                <div className="mb-3 p-3 bg-warning-soft border border-warning-line rounded-md">
                    <p className="text-sm text-warning-strong">
                        ⏳ Processing task result...
                    </p>
                </div>
            )}

            {/* Task completion success state */}
            {task && taskStatus === 'completed' && extractionSucceeded && (
                <div className="mb-3 p-3 bg-success-soft border border-success-line rounded-md">
                    <p className="text-sm font-medium text-success-strong">
                        ✅ Task completed! Field has been auto-populated with the result.
                    </p>
                    {showResultDetails && <WorldTaskResultDetails details={resultDetails} />}
                    {scanWarnings.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-warning-strong">
                            {scanWarnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                            ))}
                        </ul>
                    )}
                    {!field.isReadOnly && (
                        <button
                            type="button"
                            onClick={handleRunAgain}
                            className="mt-2 text-xs px-2 py-1 bg-success-line text-success-strong rounded hover:bg-green-300"
                        >
                            Capture again
                        </button>
                    )}
                </div>
            )}

            {/* Extraction error state */}
            {extractionError && (
                <div className="mb-3 p-3 bg-danger-soft border border-danger-line rounded-md">
                    <p className="text-sm font-medium text-danger-strong">
                        ⚠️ Result Processing Error
                    </p>
                    <p className="text-xs text-danger-strong mt-1">
                        {extractionError}
                    </p>
                </div>
            )}

            {/* KNG-268: the API refused to start the task, with its reason */}
            {createError && !task && (
                <div className="mb-3 p-3 bg-danger-soft border border-danger-line rounded-md">
                    <p className="text-sm font-medium text-danger-strong">
                        ❌ Couldn't start
                    </p>
                    <p className="text-xs text-danger-strong mt-1">{createError}</p>
                </div>
            )}

            {/* Task failure display */}
            {task && taskStatus === 'failed' && (
                <div className="mb-3 p-3 bg-danger-soft border border-danger-line rounded-md">
                    <p className="text-sm font-medium text-danger-strong">
                        ❌ Task Failed
                    </p>
                    {task.errorMessage && (
                        <p className="text-xs text-danger-strong mt-1">{task.errorMessage}</p>
                    )}
                    {startAgainButton('Try Again', 'red')}
                </div>
            )}

            {/* #180: the task ended without a result */}
            {task && (taskStatus === 'cancelled' || taskStatus === 'expired') && (
                <div className="mb-3 p-3 bg-surface-alt border border-gray-300 rounded-md">
                    <p className="text-sm font-medium text-gray-800">
                        {taskStatus === 'expired' ? '⌛ Task expired' : '✖ Task cancelled'}
                    </p>
                    <p className="text-xs text-gray-700 mt-1">
                        {task.errorMessage
                            || (taskStatus === 'expired'
                                ? 'Nobody claimed it in time; its task code no longer works.'
                                : 'Its task code no longer works.')}
                    </p>
                    {startAgainButton('Start again', 'gray')}
                </div>
            )}

            {/* Cached scan summary from a previous run (survives saved/resumed drafts) */}
            {!task && !taskId && GATE_BLOCK_SCAN_TASK_TYPES.includes(taskType) && value?.status && (
                <div className="mb-3 p-3 bg-surface-alt border border-line rounded-md">
                    <p className="text-sm text-gray-700">
                        Previously scanned: <strong>{value.blockCount ?? 0} blocks</strong> ({value.status})
                    </p>
                </div>
            )}

            {/* Button to create in Minecraft */}
            {gateScanBlocked && !field.isReadOnly && !taskId && (
                <p className="text-xs text-warning bg-warning-soft border border-warning-line rounded-md px-3 py-2">
                    Save the gate first; scanning needs an existing gate ID.
                </p>
            )}
            {/* #181 busy check: you already hold a task in game */}
            {busy && (!taskId || sendAgainVisible) && !field.isReadOnly && (
                <div className="mb-3 p-3 bg-warning-soft border border-amber-300 rounded-md" role="alertdialog" aria-label="You already have a task in game">
                    <p className="text-sm font-medium text-warning-strong">You already have a task open in game.</p>
                    <p className="text-xs text-warning-strong mt-1">
                        {busy.task?.fieldName ? `${busy.task.fieldName}` : 'A task'}
                        {busy.formName ? ` of “${busy.formName}”` : ''}
                        {busy.queued > 0 ? ` · ${busy.queued} more waiting in your queue` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-secondary text-xs px-2 py-1" onClick={() => void deliverTask('queue')}>
                            Queue
                        </button>
                        <button type="button" className="btn btn-secondary text-xs px-2 py-1" onClick={() => { setBusy(null); void openHandOff(); }}>
                            Hand off…
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary text-xs px-2 py-1"
                            onClick={() => void deliverTask('replace')}
                            title="The task you hold goes back with its task code; this one is sent to you"
                        >
                            Replace
                        </button>
                        <button type="button" className="btn btn-tertiary text-xs px-2 py-1" onClick={() => setBusy(null)}>
                            Cancel
                        </button>
                    </div>
                    <p className="text-xs text-warning mt-2">
                        Queue: sent to you when that task ends. Replace: {busy.formName ? `“${busy.formName}”` : 'the other form'} loses
                        the task in game; its task code keeps working.
                    </p>
                </div>
            )}

            {/* #181 "Hand off to…": an online player gets Accept/Decline in game */}
            {handOffOpen && (!taskId || sendAgainVisible) && !field.isReadOnly && (
                <div className="mb-3 p-3 bg-surface border border-gray-300 rounded-md" aria-label="Hand off to">
                    <p className="text-sm font-medium text-gray-800">Hand off to an online player</p>
                    {staff === null && !staffError && <p className="text-xs text-gray-600 mt-1">Loading who is online…</p>}
                    {staffError && <p className="text-xs text-danger-strong mt-1">{staffError}</p>}
                    {staff && staff.length === 0 && (
                        <p className="text-xs text-gray-600 mt-1">Nobody else with world-task access is online in game.</p>
                    )}
                    {staff && staff.length > 0 && (
                        <ul className="mt-2 space-y-1">
                            {staff.map(person => (
                                <li key={person.userId}>
                                    <button
                                        type="button"
                                        className="text-sm text-left w-full px-2 py-1 rounded hover:bg-gray-100"
                                        onClick={() => void deliverTask({ userId: person.userId })}
                                    >
                                        {person.username}
                                        <span className="text-xs text-muted"> · {person.serverId}{person.world ? ` / ${person.world}` : ''}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <button type="button" className="mt-2 text-xs text-gray-600 underline" onClick={() => setHandOffOpen(false)}>
                        Close
                    </button>
                </div>
            )}

            {allowCreate && !field.isReadOnly && !taskId && !gateScanBlocked && (
                <button
                    type="button"
                    id={actionButtonId}
                    onClick={() => void handleSendToMinecraft()}
                    disabled={isLoading}
                    className={hidePrimaryActionButton ? 'hidden' : 'px-4 py-2 bg-success text-success-fg rounded-md hover:bg-success-strong disabled:bg-gray-400'}
                >
                    {isHeadlessTaskType(taskType)
                        ? (isLoading ? 'Starting scan...' : (value ? 'Re-scan' : 'Start scan'))
                        : (isLoading ? 'Creating task...' : (value ? 'Replace via Minecraft' : 'Send to Minecraft'))}
                </button>
            )}
            {allowCreate && !field.isReadOnly && !taskId && !gateScanBlocked && !hidePrimaryActionButton
                && realtime.connected && !isHeadlessTaskType(taskType) && (
                <button
                    type="button"
                    onClick={() => void openHandOff()}
                    disabled={isLoading}
                    className="ml-2 px-3 py-2 border border-gray-300 bg-surface text-gray-700 rounded-md hover:bg-surface-alt disabled:opacity-50"
                >
                    Hand off to…
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

/** "14:35" in the browser's time zone, or null when the date can't be read. */
function formatClockTime(iso: string): string | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
