import React, { useEffect, useMemo, useRef, useState } from 'react';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import { workflowClient } from '../../apiClients/workflowClient';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';
import { WorldTaskReadDto } from '../../types/dtos/workflow/WorkflowDtos';
import { FieldValidationRuleDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { AlertCircle, CheckCircle2, Loader2, Send, Copy, Check } from 'lucide-react';

type Props = {
  workflowSessionId: number;
  stepKey: string;
  fieldName: string;
  value: any;
  taskType?: string; // optional override; else defaults to `Verify${fieldName}`
  onCompleted?: (task: WorldTaskReadDto) => void;
  hint?: string; // optional hint to show when pending/missing
  // NEW: Additional props for validation context
  fieldId?: number; // Field ID to load validation rules
  formContext?: Record<string, unknown>; // All form data for dependency resolution
};

const POLL_MS = 3000;

export const WorldTaskCta: React.FC<Props> = ({
  workflowSessionId,
  stepKey,
  fieldName,
  value,
  taskType,
  onCompleted,
  hint,
  fieldId,
  formContext = {}
}) => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<WorldTaskReadDto | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);
  const timerRef = useRef<number | undefined>();

  const effectiveTaskType = useMemo(() => taskType || `Verify${fieldName}`,
    [taskType, fieldName]);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  };

  const startPolling = (taskId: number) => {
    clearTimer();
    timerRef.current = window.setInterval(async () => {
      try {
        const t = await worldTaskClient.getById(taskId);
        setTask(t);
        if (t.status?.toLowerCase() === 'completed') {
          clearTimer();
          await workflowClient.completeStep(workflowSessionId, stepKey);
          onCompleted?.(t);
        }
      } catch (e) {
        // swallow intermittent errors; retry next tick
      }
    }, POLL_MS);
  };

  useEffect(() => () => clearTimer(), []);

  const handleCopyCode = async (code: string, taskId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(taskId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleSend = async () => {
    setError(null);
    setCreating(true);
    try {
      // Build base payload
      const payload: Record<string, unknown> = {
        fieldName,
        currentValue: value ?? null,
      };

      // Load and resolve validation rules if fieldId is provided
      if (fieldId) {
        try {
          const validationRules = await fieldValidationRuleClient.getByFormFieldId(fieldId);
          
          if (validationRules && validationRules.length > 0) {
            // Resolve dependency field values from formContext
            const resolvedRules = validationRules.map((rule: FieldValidationRuleDto) => ({
              validationType: rule.validationType,
              configJson: rule.configJson,
              errorMessage: rule.errorMessage,
              isBlocking: rule.isBlocking,
              dependencyFieldValue: rule.dependsOnFieldId 
                ? resolveDependencyFieldValue(rule.dependsOnFieldId, formContext)
                : null
            }));

            // Embed validation context in payload
            payload.validationContext = {
              validationRules: resolvedRules,
              formContext: formContext
            };
          }
        } catch (validationError) {
          console.warn('Failed to load validation rules, proceeding without validation:', validationError);
          // Continue without validation context
        }
      }

      const created = await worldTaskClient.create({
        workflowSessionId,
        stepNumber: 0,
        stepKey,
        fieldName,
        taskType: effectiveTaskType,
        inputJson: JSON.stringify(payload)
      });
      setTask(created);
      startPolling(created.id);
    } catch (e) {
      setError('Failed to send task to Minecraft. Retrying is possible.');
    } finally {
      setCreating(false);
    }
  };

  // Helper function to resolve dependency field value from form context
  const resolveDependencyFieldValue = (dependencyFieldId: number, context: Record<string, unknown>): unknown => {
    // In a real implementation, this would:
    // 1. Find the field name by ID from the form configuration
    // 2. Extract the value from context
    // 3. If it's an entity reference, fetch the full entity
    // For now, return the raw value from context
    // TODO: Implement proper field ID -> field name resolution
    const fieldEntry = Object.entries(context).find(([key, val]) => {
      // Try to match by various patterns
      return typeof val === 'object' && val !== null && 'id' in val;
    });
    
    return fieldEntry ? fieldEntry[1] : null;
  };

  const statusPill = () => {
    if (!task) return null;
    const s = task.status?.toLowerCase();
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
        </span>
      );
    }
    if (s === 'accepted' || s === 'inprogress' || s === 'in-progress') {
      return (
        <span className="inline-flex items-center text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
        Pending
      </span>
    );
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          className="btn-secondary flex items-center"
          disabled={creating}
          title="Send task to Minecraft"
        >
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Send className="h-4 w-4 mr-2"/>}
          Send to Minecraft
        </button>
        {task && statusPill()}
        {error && (
          <span className="inline-flex items-center text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 text-xs">
            <AlertCircle className="h-3 w-3 mr-1"/> {error}
          </span>
        )}
        {!task && hint && (
          <span className="text-xs text-gray-500">{hint}</span>
        )}
      </div>

      {/* Prominent claim code display for Pending tasks */}
      {task && task.status === 'Pending' && task.linkCode && (
        <div className="mt-3 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-sm">
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

      {/* Task status for InProgress state */}
      {task && (task.status === 'InProgress' || task.status === 'Accepted') && task.claimedByMinecraftUsername && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Claimed by: <strong>{task.claimedByMinecraftUsername}</strong>
            {task.claimedByServerId && ` on ${task.claimedByServerId}`}
          </p>
        </div>
      )}

      {/* Task failure display with enhanced validation error messaging */}
      {task && task.status === 'Failed' && (
        <div className="mt-3 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-900 mb-1">
                ❌ Task Failed
              </p>
              {task.errorMessage && (
                <div className="text-sm text-red-800 mb-2 whitespace-pre-wrap">
                  {task.errorMessage}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-red-200">
                <p className="text-xs text-red-700">
                  💡 <strong>What to do:</strong>
                </p>
                <ul className="text-xs text-red-700 ml-4 mt-1 space-y-1">
                  <li>• Fix the issue in Minecraft and retry the task</li>
                  <li>• Or cancel this task and start over</li>
                  <li>• If you believe this is an error, contact a developer</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldTaskCta;
