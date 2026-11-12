import React, { useCallback, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { DisplaySection } from '../DisplayWizard/DisplaySection';
import { DisplayConfigurationDto, DisplaySectionDto } from '../../types/dtos/displayConfig/DisplayModels';
import { sampleDisplayRecord } from '../../utils/configBuilder/previewData';
import { PreviewRecordSource, PreviewSource } from './PreviewRecordSource';

type Row = Record<string, unknown>;

export interface DisplayPreviewProps {
    config: DisplayConfigurationDto;
    entityLabel: string;
}

/** The page's top-level sections in their saved order (sectionOrderJson by GUID, else as listed). */
export function orderedSections(config: DisplayConfigurationDto): DisplaySectionDto[] {
    try {
        const order: string[] = config.sectionOrderJson ? JSON.parse(config.sectionOrderJson) : [];
        const sections = config.sections.filter(s => !s.parentSectionId || !config.sections.some(p => p.id === s.parentSectionId));
        if (order.length > 0 && sections.every(s => s.sectionGuid && order.includes(s.sectionGuid))) {
            return [...sections].sort((a, b) => order.indexOf(a.sectionGuid!) - order.indexOf(b.sectionGuid!));
        }
        return sections;
    } catch {
        return config.sections;
    }
}

/**
 * PandiO/knk-workspace#71 (CRUD-13): the detail page as it would look with the builder's working copy, with sample
 * values or a real record. Buttons do nothing here and values can't be edited (nothing is saved); links are off.
 */
export const DisplayPreview: React.FC<DisplayPreviewProps> = ({ config, entityLabel }) => {
    const [source, setSource] = useState<PreviewSource>('sample');
    const [record, setRecord] = useState<Row | null>(null);
    const onRecord = useCallback((next: Row | null) => setRecord(next), []);
    const sample = useMemo(() => sampleDisplayRecord(config), [config]);
    const data = source === 'record' && record ? record : sample;
    const sections = useMemo(() => orderedSections(config), [config]);

    return (
        <section aria-label="Display preview" className="panel bg-surface p-4 space-y-4" data-testid="display-preview">
            <div className="flex items-start gap-2 text-xs text-muted">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p>Preview of the working copy: buttons and links are off, and nothing is saved.</p>
            </div>
            <PreviewRecordSource
                entityTypeName={config.entityTypeName}
                entityLabel={entityLabel}
                source={source}
                onSourceChange={setSource}
                onRecord={onRecord}
            />
            <div className="border-t border-line pt-4">
                <h2 className="text-2xl font-bold text-fg">{config.name || 'Unnamed display'}</h2>
                {config.description && <p className="mt-1 text-muted">{config.description}</p>}
            </div>
            {sections.length === 0 ? (
                <p className="text-sm text-muted">No sections yet. Add a section, or Generate from metadata under More.</p>
            ) : (
                // `inert`-like: the page's own buttons stay visible but clicks inside do nothing.
                <div className="space-y-6" onClickCapture={event => {
                    const target = event.target as HTMLElement;
                    if (target.closest('button, a')) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }}>
                    {sections.map(section => (
                        <DisplaySection
                            key={section.sectionGuid ?? section.id ?? section.sectionName}
                            section={section}
                            entityData={data}
                            entityId={(data.id as number | undefined) ?? 1}
                            entityTypeName={config.entityTypeName}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};
