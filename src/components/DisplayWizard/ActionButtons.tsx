// ActionButtons Component - Renders dynamic action buttons based on configuration
import React, { useId } from 'react';
import { Eye, Edit, Plus, Link, Unlink, Trash2, PlusCircle } from 'lucide-react';
import { ActionButtonsConfigDto, DisplayAction } from '../../types/dtos/displayConfig/DisplayModels';
import { RelationshipMetadataDto } from '../../types/dtos/metadata/MetadataModels';

/** Whether a button may be used, and why not (shown next to the disabled button, the #280 rule). */
export interface ButtonGate {
  allowed: boolean;
  /** "Requires knk.admin.world", "A District always belongs to one Town: …", or null while allowed. */
  reason: string | null;
}

export const OPEN_GATE: ButtonGate = { allowed: true, reason: null };

interface ActionButtonsProps {
  config: ActionButtonsConfigDto;
  isCollection: boolean;
  /** The type View/Edit/Delete open (for a link row the other side, e.g. Tag). */
  entityType?: string;
  entityData?: Record<string, unknown>;
  onActionClick?: (action: DisplayAction) => void;
  isItemLevel?: boolean; // For collection items
  onEdit?: (entityId: number | string) => void; // Callback for edit action
  onCreateNew?: () => void; // Callback for create action
  /**
   * #188: the section's relationship from the page type's metadata. Without it Select / Unlink / Add / Remove aren't
   * shown (nothing to change through the API).
   */
  relationship?: RelationshipMetadataDto;
  /** The id of the record the buttons act on (a link row's other side); default `entityData.id`. */
  relatedId?: number;
  /** Its name, for the questions and toasts. */
  relatedLabel?: string;
  linkGate?: ButtonGate;
  unlinkGate?: ButtonGate;
  /** Delete of the related record (the type's `actionNodes.delete`). */
  deleteGate?: ButtonGate;
}

/** "Change…: X" and "Unlink: X" → "Change… and Unlink: X". */
export function mergeHints(texts: string[]): string[] {
  const byReason = new Map<string, string[]>();
  texts.forEach(text => {
    const at = text.indexOf(': ');
    const label = at < 0 ? '' : text.slice(0, at);
    const reason = at < 0 ? text : text.slice(at + 2);
    byReason.set(reason, [...(byReason.get(reason) ?? []), label].filter(Boolean));
  });
  return Array.from(byReason, ([reason, labels]) => (labels.length ? `${labels.join(' and ')}: ${reason}` : reason));
}

const BUTTON = 'btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm';

/**
 * The buttons of a related section or collection item (PandiO/knk-workspace#188):
 * - View / Edit open the related record; Create New opens its form;
 * - Select (a single relation) and Add (a collection) pick an **existing** record; Unlink (single) and Unlink on an
 *   item (the configuration's "Remove") only remove the link, never the record;
 * - Delete (`showDeleteButton`, items only) is a separate red action that deletes the record itself.
 * A button the user can't use is disabled with the reason ("Requires …" or why the link can't change here).
 */
export const ActionButtons: React.FC<ActionButtonsProps> = ({
  config,
  isCollection,
  entityType,
  entityData,
  onActionClick,
  isItemLevel = false,
  onEdit,
  onCreateNew,
  relationship,
  relatedId,
  relatedLabel,
  linkGate = OPEN_GATE,
  unlinkGate = OPEN_GATE,
  deleteGate = OPEN_GATE,
}) => {
  const hintBase = useId();
  if (!entityType) return null;

  const targetId = relatedId ?? (entityData?.id as number | undefined);
  const handleClick = (type: DisplayAction['type']) => {
    onActionClick?.({
      type,
      entityType,
      entityId: targetId,
      property: relationship?.property,
      label: relatedLabel,
    });
  };

  const hints: { id: string; text: string }[] = [];
  const gated = (
    key: string,
    label: string,
    icon: React.ReactNode,
    gate: ButtonGate,
    type: DisplayAction['type'],
    className = BUTTON,
    accessibleName?: string
  ) => {
    const id = `${hintBase}-${key}`;
    if (!gate.allowed && gate.reason) hints.push({ id, text: isItemLevel ? gate.reason : `${label}: ${gate.reason}` });
    return (
      <button
        key={key}
        type="button"
        className={className}
        disabled={!gate.allowed}
        title={!gate.allowed && gate.reason ? gate.reason : undefined}
        aria-label={accessibleName}
        aria-describedby={!gate.allowed && gate.reason ? id : undefined}
        onClick={() => handleClick(type)}
      >
        {icon}
        {label}
      </button>
    );
  };

  const hasRecord = targetId != null;
  const buttons: React.ReactNode[] = [];

  if (config.showViewButton && entityData && hasRecord) {
    buttons.push(
      <button key="view" type="button" className={BUTTON} onClick={() => handleClick('view')}
        aria-label={isItemLevel && relatedLabel ? `View ${relatedLabel}` : undefined}>
        <Eye size={16} aria-hidden="true" />
        View
      </button>
    );
  }

  if (config.showEditButton && entityData && hasRecord) {
    buttons.push(
      <button key="edit" type="button" className={BUTTON}
        aria-label={isItemLevel && relatedLabel ? `Edit ${relatedLabel}` : undefined}
        onClick={() => onEdit ? onEdit(targetId as number) : handleClick('edit')}>
        <Edit size={16} aria-hidden="true" />
        Edit
      </button>
    );
  }

  if (!isCollection && relationship) {
    if (config.showSelectButton) {
      buttons.push(gated('select', hasRecord && entityData ? 'Change…' : 'Select…', <Link size={16} aria-hidden="true" />, linkGate, 'select'));
    }
    if (config.showUnlinkButton && entityData && hasRecord) {
      buttons.push(gated('unlink', 'Unlink', <Unlink size={16} aria-hidden="true" />, unlinkGate, 'unlink'));
    }
  }

  if (isCollection && !isItemLevel && relationship && config.showAddButton) {
    buttons.push(gated('add', 'Add…', <Plus size={16} aria-hidden="true" />, linkGate, 'add'));
  }

  if (isCollection && isItemLevel && relationship && config.showRemoveButton && hasRecord) {
    // "Remove" in the configuration: unlinks the item, never deletes it (CRUD-16).
    buttons.push(gated('unlink', 'Unlink', <Unlink size={16} aria-hidden="true" />, unlinkGate, 'unlink', BUTTON,
      relatedLabel ? `Unlink ${relatedLabel}` : undefined));
  }

  if (isCollection && isItemLevel && config.showDeleteButton && hasRecord) {
    buttons.push(gated('delete', 'Delete', <Trash2 size={16} aria-hidden="true" />, deleteGate, 'delete',
      'btn-danger inline-flex items-center gap-1.5 px-3 py-1.5 text-sm', relatedLabel ? `Delete ${relatedLabel}` : undefined));
  }

  // Create New belongs to the section (its header), not to each item.
  if (config.showCreateButton && !isItemLevel) {
    buttons.push(
      <button key="create" type="button" className={BUTTON} onClick={() => onCreateNew ? onCreateNew() : handleClick('create')}>
        <PlusCircle size={16} aria-hidden="true" />
        Create New
      </button>
    );
  }

  if (buttons.length === 0) return null;

  return (
    <div className={isItemLevel ? 'mt-3 pt-3 border-t border-line' : 'mt-4'}>
      <div className="flex flex-wrap gap-2">{buttons}</div>
      {hints.map(hint => (
        <p key={hint.id} id={hint.id} className="sr-only">{hint.text}</p>
      ))}
      {/* Visible once per reason: "Change… and Unlink: Change this on the Edit page." */}
      {!isItemLevel && mergeHints(hints.map(hint => hint.text)).map(text => (
        <p key={text} className="mt-2 text-xs text-muted" data-testid="action-hint" aria-hidden="true">{text}</p>
      ))}
    </div>
  );
};
