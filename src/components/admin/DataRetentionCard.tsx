import React from 'react';
import { Loader2, Save } from 'lucide-react';
import { auditLogRetentionClient } from '../../apiClients/auditLogRetentionClient';

// How long the audit log and the private message log are kept (knk-web-api
// AuditLogRetentionConfiguration; docs/specs/private-messages/DESIGN.md §3.1 - private messages
// default to 30 days). Anyone may read the values; saving needs knk.admin.config, and the API's
// own refusal message is shown to anyone without it.
//
// Lowering a period deletes everything older at the next daily cleanup, for good, so it needs a
// typed confirmation first (SET-2, KNG-141).

const CONFIRM_WORD = 'DELETE';

const parseDays = (value: string): number | null => {
    if (!/^\d+$/.test(value.trim())) return null;
    const days = Number(value);
    return days >= 1 ? days : null;
};

export const DataRetentionCard: React.FC = () => {
    const [retentionDays, setRetentionDays] = React.useState('');
    const [privateMessageRetentionDays, setPrivateMessageRetentionDays] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const [saved, setSaved] = React.useState(false);
    // The values the server has now; a lower value than these deletes history.
    const [current, setCurrent] = React.useState<{ audit: number; pm: number } | null>(null);
    const [confirming, setConfirming] = React.useState(false);
    const [confirmText, setConfirmText] = React.useState('');

    React.useEffect(() => {
        let cancelled = false;
        auditLogRetentionClient.get()
            .then((config) => {
                if (cancelled) return;
                setRetentionDays(String(config.retentionDays));
                setPrivateMessageRetentionDays(String(config.privateMessageRetentionDays));
                setCurrent({ audit: config.retentionDays, pm: config.privateMessageRetentionDays });
            })
            .catch((err) => {
                console.error('Failed to load retention configuration:', err);
                if (!cancelled) setLoadError('Could not load the retention settings.');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const auditDays = parseDays(retentionDays);
    const pmDays = parseDays(privateMessageRetentionDays);

    const lowered: string[] = [];
    if (current && auditDays !== null && auditDays < current.audit) {
        lowered.push(`audit log entries older than ${auditDays} days (now ${current.audit})`);
    }
    if (current && pmDays !== null && pmDays < current.pm) {
        lowered.push(`private messages older than ${pmDays} days (now ${current.pm})`);
    }

    const resetConfirm = () => {
        setConfirming(false);
        setConfirmText('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (auditDays === null || pmDays === null) return;
        if (lowered.length > 0 && !confirming) {
            setConfirming(true);
            return;
        }
        if (lowered.length > 0 && confirmText.trim() !== CONFIRM_WORD) return;
        setSaving(true);
        setSaveError(null);
        setSaved(false);
        try {
            const updated = await auditLogRetentionClient.update({
                retentionDays: auditDays,
                privateMessageRetentionDays: pmDays,
            });
            setRetentionDays(String(updated.retentionDays));
            setPrivateMessageRetentionDays(String(updated.privateMessageRetentionDays));
            setCurrent({ audit: updated.retentionDays, pm: updated.privateMessageRetentionDays });
            resetConfirm();
            setSaved(true);
        } catch (err) {
            console.error('Failed to save retention configuration:', err);
            const status = (err as { status?: number } | null)?.status;
            const message = err instanceof Error ? err.message : null;
            setSaveError(status !== undefined && status >= 400 && status < 500 && message ? message : 'Could not save the retention settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Data Retention</h2>
            <p className="text-sm text-gray-600">
                Entries older than this are deleted by the daily cleanup. Private messages are players’ own words, kept
                only for moderation, so they are kept much shorter than the audit log.
            </p>
            {loading ? (
                <div className="flex items-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                </div>
            ) : loadError ? (
                <p className="text-sm text-red-600">{loadError}</p>
            ) : (
                <form className="space-y-4" onSubmit={(e) => void handleSave(e)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="retention-audit-days" className="block text-sm font-medium text-gray-700 mb-1">Audit log (days)</label>
                            <input
                                id="retention-audit-days"
                                type="number"
                                min={1}
                                value={retentionDays}
                                onChange={(e) => { setRetentionDays(e.target.value); setSaved(false); resetConfirm(); }}
                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label htmlFor="retention-pm-days" className="block text-sm font-medium text-gray-700 mb-1">Private messages (days)</label>
                            <input
                                id="retention-pm-days"
                                type="number"
                                min={1}
                                value={privateMessageRetentionDays}
                                onChange={(e) => { setPrivateMessageRetentionDays(e.target.value); setSaved(false); resetConfirm(); }}
                                className="block w-full rounded-md border-gray-300 focus:border-primary focus:ring-primary"
                            />
                        </div>
                    </div>
                    {(auditDays === null || pmDays === null) && (
                        <p className="text-xs text-red-600">Both values must be whole numbers of at least 1 day.</p>
                    )}
                    {confirming && lowered.length > 0 && (
                        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 space-y-2">
                            <p className="font-medium">This permanently deletes history at the next daily cleanup:</p>
                            <ul className="list-disc pl-5">
                                {lowered.map(line => <li key={line}>{line}</li>)}
                            </ul>
                            <label htmlFor="retention-confirm" className="block">
                                Type <strong>{CONFIRM_WORD}</strong> to confirm.
                            </label>
                            <input
                                id="retention-confirm"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className="block w-48 rounded-md border-red-300 focus:border-red-500 focus:ring-red-500"
                                autoComplete="off"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            className={`${confirming ? 'btn-danger' : 'btn-primary'} text-sm`}
                            disabled={saving || auditDays === null || pmDays === null
                                || (confirming && lowered.length > 0 && confirmText.trim() !== CONFIRM_WORD)}
                        >
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {confirming && lowered.length > 0 ? 'Delete older entries and save' : 'Save retention'}
                        </button>
                        {confirming && (
                            <button type="button" className="btn-secondary text-sm" onClick={resetConfirm}>Cancel</button>
                        )}
                        {saved && <span className="text-xs text-green-700">Saved.</span>}
                        {saveError && <span className="text-xs text-red-600">{saveError}</span>}
                    </div>
                </form>
            )}
        </div>
    );
};
