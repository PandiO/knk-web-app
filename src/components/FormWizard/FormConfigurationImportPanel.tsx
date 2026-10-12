import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { formConfigClient } from '../../apiClients/formConfigClient';
import {
    FormConfigurationImportResult,
    FormConfigurationSeed,
    PortableFormConfiguration
} from '../../types/dtos/forms/FormPortabilityModels';
import { describeImportCounts, describeImportResult, readPortableFile } from '../../utils/forms/formConfigPortability';
import { failureReason } from '../../utils/apiRefusalReason';

/**
 * KNG-138: import a form configuration file, or one of the API's bundled seeds. Every import is
 * dry-run first (nothing written) and the result is shown; Import is only offered once the dry run
 * passed with the current "make default" choice. The API never overwrites: a file whose
 * configurationGuid is already in the database reports "Already imported".
 */
interface Props {
    open: boolean;
    /** The entity selected on the page; its seeds are listed first. */
    entityTypeName?: string | null;
    onClose: () => void;
    /** Called after a successful import (the page reloads its list). */
    onImported: (result: FormConfigurationImportResult) => void;
}

/** File.text() is missing in some test DOMs; FileReader works everywhere. */
const readFileText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
        reader.readAsText(file);
    });

const errorText = (err: unknown) => failureReason(err) ?? 'Something went wrong.';

export const ImportResultView: React.FC<{ result: FormConfigurationImportResult; label: string }> = ({ result, label }) => {
    const ok = result.status === 'DryRunPassed' || result.status === 'Imported';
    return (
        <div
            role="status"
            aria-label={label}
            className={`mt-2 rounded-md border px-3 py-2 text-sm ${ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-yellow-200 bg-yellow-50 text-yellow-900'}`}
        >
            <p className="font-medium">{describeImportResult(result)}</p>
            {result.status !== 'AlreadyImported' && result.status !== 'Invalid' && (
                <p className="text-xs text-gray-600">{describeImportCounts(result)}</p>
            )}
            {result.errors.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-red-700" aria-label="Import problems">
                    {result.errors.map((error, i) => <li key={i}>{error}</li>)}
                </ul>
            )}
            {result.warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-yellow-800" aria-label="Import warnings">
                    {result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
                </ul>
            )}
        </div>
    );
};

interface FileState {
    fileName: string;
    file?: PortableFormConfiguration;
    readError?: string;
    result?: FormConfigurationImportResult;
    checkedWithDefault?: boolean;
}

interface SeedState {
    result?: FormConfigurationImportResult;
    checkedWithDefault?: boolean;
    error?: string;
}

export const FormConfigurationImportPanel: React.FC<Props> = ({ open, entityTypeName, onClose, onImported }) => {
    const [makeDefault, setMakeDefault] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [fileState, setFileState] = useState<FileState | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [seeds, setSeeds] = useState<FormConfigurationSeed[] | null>(null);
    const [seedsError, setSeedsError] = useState<string | null>(null);
    const [seedStates, setSeedStates] = useState<Record<string, SeedState>>({});
    const [showAllSeeds, setShowAllSeeds] = useState(false);

    const loadSeeds = useCallback(async () => {
        setSeedsError(null);
        try {
            setSeeds(await formConfigClient.getSeeds());
        } catch (err) {
            setSeeds([]);
            setSeedsError(errorText(err));
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        setMakeDefault(false);
        setFileState(null);
        setFileError(null);
        setSeedStates({});
        setShowAllSeeds(false);
        setSeeds(null);
        loadSeeds();
    }, [open, loadSeeds]);

    const checkFile = async (file: PortableFormConfiguration, fileName: string, asDefault: boolean) => {
        setBusy('file');
        setFileError(null);
        try {
            const result = await formConfigClient.importConfiguration(file, { dryRun: true, makeDefault: asDefault });
            setFileState({ fileName, file, result, checkedWithDefault: asDefault });
        } catch (err) {
            setFileState({ fileName, file });
            setFileError(errorText(err));
        } finally {
            setBusy(null);
        }
    };

    if (!open) return null;

    const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = event.target.files?.[0];
        event.target.value = '';
        if (!chosen) return;
        let text: string;
        try {
            text = await readFileText(chosen);
        } catch (err) {
            setFileState({ fileName: chosen.name, readError: errorText(err) });
            return;
        }
        const read = readPortableFile(text);
        if (read.error !== undefined) {
            setFileState({ fileName: chosen.name, readError: read.error });
            return;
        }
        await checkFile(read.file, chosen.name, makeDefault);
    };

    const handleMakeDefaultChange = (value: boolean) => {
        setMakeDefault(value);
        // A dry run answers for one choice; check again (the file automatically, seeds on request).
        setSeedStates({});
        if (fileState?.file && fileState.result?.status !== 'Imported') {
            checkFile(fileState.file, fileState.fileName, value);
        }
    };

    const importFile = async () => {
        if (!fileState?.file) return;
        setBusy('file');
        setFileError(null);
        try {
            const result = await formConfigClient.importConfiguration(fileState.file, { dryRun: false, makeDefault });
            setFileState({ ...fileState, result, checkedWithDefault: makeDefault });
            if (result.status === 'Imported') {
                onImported(result);
                loadSeeds();
            }
        } catch (err) {
            setFileError(errorText(err));
        } finally {
            setBusy(null);
        }
    };

    const runSeed = async (seed: FormConfigurationSeed, dryRun: boolean) => {
        setBusy(`seed:${seed.name}`);
        try {
            const result = await formConfigClient.importSeed(seed.name, { dryRun, makeDefault });
            setSeedStates(prev => ({ ...prev, [seed.name]: { result, checkedWithDefault: makeDefault } }));
            if (result.status === 'Imported') {
                onImported(result);
                await loadSeeds();
            }
        } catch (err) {
            setSeedStates(prev => ({ ...prev, [seed.name]: { error: errorText(err) } }));
        } finally {
            setBusy(null);
        }
    };

    const matchesEntity = (seed: FormConfigurationSeed) =>
        !!entityTypeName && seed.entityTypeName?.toLowerCase() === entityTypeName.toLowerCase();
    const entitySeeds = (seeds ?? []).filter(matchesEntity);
    const visibleSeeds = showAllSeeds || !entityTypeName ? (seeds ?? []) : entitySeeds;
    const fileReady = fileState?.result?.status === 'DryRunPassed' && fileState.checkedWithDefault === makeDefault;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => !busy && onClose()}>
            <div
                role="dialog"
                aria-label="Import form configurations"
                className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-lg"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Import form configurations</h3>
                        <p className="mt-1 text-sm text-gray-600">
                            Every import is checked first (dry run, nothing written). Importing never changes an existing
                            configuration: a file that was imported before is reported as already imported.
                        </p>
                    </div>
                    <button onClick={onClose} disabled={!!busy} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-6 px-5 py-4">
                    <label className="flex items-start space-x-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={makeDefault}
                            disabled={!!busy}
                            onChange={e => handleMakeDefaultChange(e.target.checked)}
                        />
                        <span>
                            Make the imported configuration the default for its entity
                            <span className="block text-xs text-gray-500">
                                Replaces the current default. Without this, an import only becomes the default when the entity has none.
                            </span>
                        </span>
                    </label>

                    <section aria-label="Import a file">
                        <h4 className="text-sm font-semibold text-gray-900">Import a file</h4>
                        <p className="text-xs text-gray-500">A JSON file made with Export on this page (format knk-formconfig/1).</p>
                        <label className="mt-2 inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                            <Upload className="mr-2 h-4 w-4" />
                            Choose file…
                            <input
                                type="file"
                                accept=".json,application/json"
                                className="sr-only"
                                aria-label="Form configuration file"
                                disabled={!!busy}
                                onChange={handleFileChosen}
                            />
                        </label>
                        {fileState && <span className="ml-3 text-sm text-gray-600">{fileState.fileName}</span>}
                        {fileState?.readError && <p className="mt-2 text-sm text-red-700" role="alert">{fileState.readError}</p>}
                        {fileError && <p className="mt-2 text-sm text-red-700" role="alert">{fileError}</p>}
                        {busy === 'file' && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-gray-400" aria-label="Working" />}
                        {fileState?.result && <ImportResultView result={fileState.result} label="File import result" />}
                        {fileReady && (
                            <button onClick={importFile} disabled={!!busy} className="btn-primary mt-2 text-sm">
                                Import {fileState?.file?.name ? `"${fileState.file.name}"` : 'file'}
                            </button>
                        )}
                    </section>

                    <section aria-label="Available seeds">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900">Available seeds</h4>
                            {entityTypeName && seeds && seeds.length > entitySeeds.length && (
                                <button className="text-xs text-primary hover:underline" onClick={() => setShowAllSeeds(v => !v)}>
                                    {showAllSeeds ? `Only ${entityTypeName}` : `Show all (${seeds.length})`}
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500">
                            Default forms shipped with the API. Join entries and child forms must be imported before the forms that use them.
                        </p>
                        {seeds === null && <Loader2 className="mt-2 h-4 w-4 animate-spin text-gray-400" aria-label="Loading seeds" />}
                        {seedsError && <p className="mt-2 text-sm text-red-700" role="alert">{seedsError}</p>}
                        {seeds !== null && visibleSeeds.length === 0 && !seedsError && (
                            <p className="mt-2 text-sm text-gray-500">
                                {entityTypeName && !showAllSeeds ? `No bundled seeds for ${entityTypeName}.` : 'No bundled seeds.'}
                            </p>
                        )}
                        <ul className="mt-2 divide-y divide-gray-100">
                            {visibleSeeds.map(seed => {
                                const state = seedStates[seed.name];
                                const ready = state?.result?.status === 'DryRunPassed' && state.checkedWithDefault === makeDefault;
                                const working = busy === `seed:${seed.name}`;
                                return (
                                    <li key={seed.name} className="py-2" aria-label={`Seed ${seed.name}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-gray-900">{seed.configurationName ?? seed.name}</p>
                                                <p className="truncate text-xs text-gray-500">
                                                    {seed.entityTypeName ?? '?'} · {seed.stepCount} steps, {seed.fieldCount} fields · {seed.name}.json
                                                </p>
                                            </div>
                                            <div className="flex flex-shrink-0 items-center gap-2">
                                                {seed.error ? (
                                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Unreadable</span>
                                                ) : seed.imported ? (
                                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        Imported (#{seed.importedFormConfigurationId})
                                                    </span>
                                                ) : (
                                                    <>
                                                        {working && <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Working" />}
                                                        <button
                                                            onClick={() => runSeed(seed, true)}
                                                            disabled={!!busy}
                                                            className="btn-secondary text-xs"
                                                        >
                                                            Check
                                                        </button>
                                                        {ready && (
                                                            <button onClick={() => runSeed(seed, false)} disabled={!!busy} className="btn-primary text-xs">
                                                                Import
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {seed.error && <p className="mt-1 text-xs text-red-700">{seed.error}</p>}
                                        {state?.error && <p className="mt-1 text-sm text-red-700" role="alert">{state.error}</p>}
                                        {state?.result && <ImportResultView result={state.result} label={`Result for ${seed.name}`} />}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
};
