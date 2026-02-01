import React, { useEffect, useState, useCallback } from 'react';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import { WorldTaskReadDto } from '../../types/dtos/workflow/WorkflowDtos';
import { TaskStatus } from '../../types/workflow';

interface TaskStatusMonitorProps {
  taskId: number | null;
  onComplete: (output: any) => void;
  onFail: (error: string) => void;
  pollInterval?: number; // milliseconds
}

export const TaskStatusMonitor: React.FC<TaskStatusMonitorProps> = ({
  taskId,
  onComplete,
  onFail,
  pollInterval = 3000
}) => {
  const [task, setTask] = useState<WorldTaskReadDto | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTaskStatus = useCallback(async () => {
    if (!taskId) return;

    try {
      const updatedTask = await worldTaskClient.getById(taskId);
      setTask(updatedTask);

      if (updatedTask.status === TaskStatus.Completed) {
        setPolling(false);
        if (updatedTask.outputJson) {
          onComplete(JSON.parse(updatedTask.outputJson));
        } else {
          onComplete({});
        }
      } else if (updatedTask.status === TaskStatus.Failed) {
        setPolling(false);
        onFail(updatedTask.errorMessage || 'Task failed with unknown error');
      }
    } catch (err) {
      setError('Failed to fetch task status');
      console.error('Task status fetch error:', err);
    }
  }, [taskId, onComplete, onFail]);

  useEffect(() => {
    if (taskId && !polling) {
      setPolling(true);
    }
  }, [taskId, polling]);

  useEffect(() => {
    if (!polling || !taskId) return;

    const interval = setInterval(fetchTaskStatus, pollInterval);
    return () => clearInterval(interval);
  }, [polling, taskId, pollInterval, fetchTaskStatus]);

  if (!taskId) return null;

  return (
    <div className="task-status-monitor">
      {error && <div className="alert alert-danger">{error}</div>}
      
      {task && (
        <div className="task-status">
          <div className="status-badge">
            <span className={`badge badge-${getStatusColor(task.status)}`}>
              {task.status}
            </span>
          </div>

          {task.status === TaskStatus.Pending && task.linkCode && (
            <div className="link-code-display">
              <strong>Link Code:</strong> <code>{task.linkCode}</code>
              <p className="text-muted small">
                Use this code to claim the task in Minecraft
              </p>
            </div>
          )}

          {task.status === TaskStatus.InProgress && (
            <div className="progress-indicator">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="sr-only">Processing...</span>
              </div>
              <span className="ml-2">Task in progress...</span>
            </div>
          )}

          {task.status === TaskStatus.Completed && (
            <div className="alert alert-success">
              Task completed successfully! ✓
            </div>
          )}

          {task.status === TaskStatus.Failed && (
            <div className="alert alert-danger">
              Task failed: {task.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getStatusColor(status: string): string {
  switch (status) {
    case TaskStatus.Pending:
      return 'warning';
    case TaskStatus.InProgress:
      return 'info';
    case TaskStatus.Completed:
      return 'success';
    case TaskStatus.Failed:
      return 'danger';
    default:
      return 'secondary';
  }
}
