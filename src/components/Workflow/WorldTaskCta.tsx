import React, { useEffect, useMemo, useRef, useState } from 'react';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import { workflowClient } from '../../apiClients/workflowClient';
import { WorldTaskReadDto } from '../../types/dtos/workflow/WorkflowDtos';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';

type Props = {
  workflowSessionId: number;
  userId: number;
  stepKey: string;
  fieldName: string;
  value: any;
  taskType?: string; // optional override; else defaults to `Verify${fieldName}`
  onCompleted?: (task: WorldTaskReadDto) => void;
  hint?: string; // optional hint to show when pending/missing
};

const POLL_MS = 3000;

export const WorldTaskCta: React.FC<Props> = ({
  workflowSessionId,
  userId,
  stepKey,
  fieldName,
  value,
  taskType,
  onCompleted,
  hint
}) => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<WorldTaskReadDto | null>(null);
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

  const handleSend = async () => {
    setError(null);
    setCreating(true);
    try {
      const payload = {
        fieldName,
        currentValue: value ?? null,
      };
      const created = await worldTaskClient.create({
        workflowSessionId,
        taskType: effectiveTaskType,
        assignedUserId: userId,
        stepKey,
        payloadJson: JSON.stringify(payload)
      });
      setTask(created);
      startPolling(created.id);
    } catch (e) {
      setError('Failed to send task to Minecraft. Retrying is possible.');
    } finally {
      setCreating(false);
    }
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
    <div className="mt-2 flex items-center gap-3">
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
  );
};

export default WorldTaskCta;
