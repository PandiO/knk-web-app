import React, { useState, useEffect } from 'react';
import { worldTaskClient } from '../../apiClients/worldTaskClient';
import { WorldTaskReadDto, WorldTaskCreateDto } from '../../types/dtos/workflow/WorkflowDtos';
import { TaskStatusMonitor } from './TaskStatusMonitor';

interface WorldBoundFieldRendererProps {
  fieldName: string;
  fieldLabel: string;
  workflowSessionId: number;
  stepNumber: number;
  taskType: string;
  value: any;
  onChange: (newValue: any) => void;
  allowExisting?: boolean;
  allowCreate?: boolean;
  existingOptions?: Array<{ id: number; name: string }>;
}

export const WorldBoundFieldRenderer: React.FC<WorldBoundFieldRendererProps> = ({
  fieldName,
  fieldLabel,
  workflowSessionId,
  stepNumber,
  taskType,
  value,
  onChange,
  allowExisting = true,
  allowCreate = true,
  existingOptions = []
}) => {
  const [currentTask, setCurrentTask] = useState<WorldTaskReadDto | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreateTask = async () => {
    setCreating(true);
    try {
      const createDto: WorldTaskCreateDto = {
        workflowSessionId,
        stepNumber,
        fieldName,
        taskType,
        inputJson: JSON.stringify({ fieldName, fieldLabel })
      };
      const newTask = await worldTaskClient.create(createDto);
      setCurrentTask(newTask);
    } catch (err) {
      console.error('Failed to create world task:', err);
      alert('Failed to create task. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleTaskComplete = (output: any) => {
    console.log('Task completed with output:', output);
    // Output should contain the created entity ID
    if (output.id || output.entityId) {
      onChange(output.id || output.entityId);
    }
  };

  const handleTaskFail = (error: string) => {
    console.error('Task failed:', error);
    alert(`Task failed: ${error}`);
    setCurrentTask(null);
  };

  // If value is already set, show it as completed
  if (value) {
    return (
      <div className="world-bound-field">
        <label>{fieldLabel}</label>
        <div className="alert alert-success">
          ✓ {fieldLabel} created (ID: {value})
        </div>
      </div>
    );
  }

  return (
    <div className="world-bound-field">
      <label>{fieldLabel}</label>
      
      {allowExisting && existingOptions.length > 0 && (
        <div className="existing-options">
          <select
            className="form-control"
            value={value || ''}
            onChange={(e) => onChange(parseInt(e.target.value))}
          >
            <option value="">Select existing {fieldLabel}</option>
            {existingOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {allowCreate && !currentTask && (
        <div className="create-option mt-2">
          <button
            className="btn btn-primary"
            onClick={handleCreateTask}
            disabled={creating}
          >
            {creating ? 'Creating...' : `Create ${fieldLabel} in Minecraft`}
          </button>
        </div>
      )}

      {currentTask && (
        <div className="task-monitor mt-2">
          <TaskStatusMonitor
            taskId={currentTask.id}
            onComplete={handleTaskComplete}
            onFail={handleTaskFail}
          />
        </div>
      )}
    </div>
  );
};
