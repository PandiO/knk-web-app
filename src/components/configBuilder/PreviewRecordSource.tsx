import React, { useEffect, useState } from 'react';
import { RelationPicker } from '../FormWizard/RelationPicker';
import { getFetchByIdFunctionForEntity } from '../../utils/entityApiMapping';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

type Row = Record<string, unknown>;

export type PreviewSource = 'sample' | 'record' | 'empty';

export interface PreviewRecordSourceProps {
    entityTypeName: string;
    entityLabel: string;
    /** Offer "Empty" (forms: the wizard opens empty). */
    allowEmpty?: boolean;
    source: PreviewSource;
    onSourceChange: (source: PreviewSource) => void;
    /** The real record shown, or null. */
    onRecord: (record: Row | null) => void;
}

/**
 * PandiO/knk-workspace#71: where the builders' preview takes its values from: made-up sample values, or a real record
 * picked with the wizard's relation picker (V6, #191) and read through the type's own GET (needs one of its read nodes).
 */
export const PreviewRecordSource: React.FC<PreviewRecordSourceProps> = ({
    entityTypeName, entityLabel, allowEmpty = false, source, onSourceChange, onRecord,
}) => {
    const [picked, setPicked] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pickedId = picked[0]?.id as number | string | undefined;

    useEffect(() => {
        if (source !== 'record' || pickedId == null || !entityTypeName) {
            onRecord(null);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        getFetchByIdFunctionForEntity(entityTypeName)(String(pickedId))
            .then(record => { if (!cancelled) onRecord(record ?? null); })
            .catch(err => {
                if (cancelled) return;
                setError(apiRefusalReason(err) ?? `This ${entityLabel} couldn't be read; the preview shows sample values.`);
                onRecord(null);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [source, pickedId, entityTypeName, entityLabel, onRecord]);

    const options: Array<{ value: PreviewSource; label: string }> = [
        { value: 'sample', label: 'Sample values' },
        { value: 'record', label: `A real ${entityLabel}` },
        ...(allowEmpty ? [{ value: 'empty' as PreviewSource, label: 'Empty' }] : []),
    ];

    return (
        <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Fill with</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {options.map(option => (
                    <label key={option.value} className="inline-flex items-center gap-2 text-sm text-fg">
                        <input
                            type="radio"
                            name={`preview-source-${entityTypeName}`}
                            className="h-4 w-4"
                            checked={source === option.value}
                            onChange={() => onSourceChange(option.value)}
                        />
                        {option.label}
                    </label>
                ))}
            </div>
            {source === 'record' && (
                <div className="space-y-1">
                    <RelationPicker
                        entityTypeName={entityTypeName}
                        label={`Preview with a ${entityLabel}`}
                        placeholder={`Search ${entityLabel}…`}
                        mode="single"
                        selected={picked}
                        onChange={setPicked}
                    />
                    {loading && <p className="text-xs text-muted" role="status">Loading the {entityLabel}…</p>}
                    {!loading && pickedId == null && <p className="text-xs text-muted">Pick one to see its values.</p>}
                    {!loading && pickedId != null && !error && (
                        <p className="text-xs text-muted" data-testid="preview-record">
                            Showing {String(picked[0].name ?? picked[0].label ?? picked[0].displayName ?? `#${pickedId}`)} (ID {String(pickedId)}).
                        </p>
                    )}
                    {error && <p className="text-xs field-error" role="alert">{error}</p>}
                </div>
            )}
        </fieldset>
    );
};
