import React, { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { emailOutboxClient } from '../../apiClients/emailOutboxClient';
import { FeedbackModal } from '../../components/FeedbackModal';
import {
  EMAIL_KINDS,
  EMAIL_OUTBOX_STATUSES,
  EmailOutboxPageDto,
  EmailOutboxStatus,
} from '../../types/dtos/email/EmailOutboxDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

const PAGE_SIZE = 25;

const STATUS_PILL: Record<EmailOutboxStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Sent: 'bg-green-100 text-green-800',
  Failed: 'bg-red-100 text-red-800',
  Expired: 'bg-slate-200 text-slate-700',
  Suppressed: 'bg-purple-100 text-purple-800',
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

type Feedback = { title: string; message: string; status: 'success' | 'error' | 'info' };

/**
 * The mail log (KNG-206, docs/guides/email.md in knk-workspace): every mail the API queued, with
 * its status, a Retry for Failed mails that still have their content, and a test mail to yourself.
 * Recipients are masked and mail bodies never reach the browser. Needs knk.admin.config.
 */
export const EmailLogPage: React.FC = () => {
  const [page, setPage] = useState<EmailOutboxPageDto | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [status, setStatus] = useState<EmailOutboxStatus | ''>('');
  const [kind, setKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPage(await emailOutboxClient.list({ pageNumber, pageSize: PAGE_SIZE, status, kind }));
    } catch (err) {
      setLoadError(apiRefusalReason(err) ?? 'Could not load the mail log.');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, status, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const sendTest = async () => {
    setBusy(true);
    try {
      const item = await emailOutboxClient.sendTest();
      setFeedback({
        title: 'Test mail queued',
        message: item.status === 'Suppressed'
          ? `The test mail to ${item.toMasked} was suppressed by the throttle: ${item.lastError ?? ''}`
          : `A test mail to ${item.toMasked} is queued. It shows as Sent here once the mail server took it.`,
        status: item.status === 'Suppressed' ? 'error' : 'success',
      });
      await load();
    } catch (err) {
      setFeedback({ title: 'Test mail not sent', message: apiRefusalReason(err) ?? 'Could not queue the test mail.', status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: number) => {
    setBusy(true);
    try {
      await emailOutboxClient.retry(id);
      await load();
    } catch (err) {
      setFeedback({ title: 'Retry failed', message: apiRefusalReason(err) ?? 'Could not retry this mail.', status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const totalPages = page ? Math.max(1, Math.ceil(page.totalCount / page.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Mail className="h-6 w-6" /> Mail log
          </h1>
          <p className="text-sm text-slate-600">
            Every mail the API sends goes through this queue. Addresses are masked; mail content is never shown.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button type="button" onClick={sendTest} disabled={busy}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Send className="h-4 w-4" /> Send test mail to me
          </button>
        </div>
      </div>

      {page && (
        <div className="flex flex-wrap gap-4 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700" data-testid="email-summary">
          <span>Transport: <strong>{page.transport}</strong>{page.transport === 'Log' && ' (mails are logged, not sent)'}</span>
          <span>Last 24 hours: <strong>{page.last24Hours}</strong> of {page.dailyCap}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Status
          <select aria-label="Status" value={status} className="rounded border border-slate-300 px-2 py-1"
            onChange={e => { setStatus(e.target.value as EmailOutboxStatus | ''); setPageNumber(1); }}>
            <option value="">All</option>
            {EMAIL_OUTBOX_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Kind
          <select aria-label="Kind" value={kind} className="rounded border border-slate-300 px-2 py-1"
            onChange={e => { setKind(e.target.value); setPageNumber(1); }}>
            <option value="">All</option>
            {EMAIL_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
      </div>

      {loadError && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</div>}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Last error</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && !page && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {page && page.items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No mails.</td></tr>
            )}
            {page?.items.map(item => (
              <tr key={item.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(item.createdAt)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[item.status] ?? 'bg-slate-100'}`}>{item.status}</span>
                  {item.status === 'Sent' && <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.sentAt)}</div>}
                  {item.status === 'Pending' && item.attempts > 0 && (
                    <div className="mt-1 text-xs text-slate-500">next try {formatDateTime(item.nextAttemptAt)}</div>
                  )}
                </td>
                <td className="px-3 py-2">{item.kind}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.toMasked}</td>
                <td className="px-3 py-2">{item.attempts}</td>
                <td className="max-w-xs break-words px-3 py-2 text-xs text-slate-600">{item.lastError ?? ''}</td>
                <td className="px-3 py-2">
                  {item.canRetry && (
                    <button type="button" onClick={() => retry(item.id)} disabled={busy}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">
                      <RotateCcw className="h-3 w-3" /> Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(n => n - 1)}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Previous</button>
          <span>Page {pageNumber} of {totalPages}</span>
          <button type="button" disabled={pageNumber >= totalPages} onClick={() => setPageNumber(n => n + 1)}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Next</button>
        </div>
      )}

      <FeedbackModal
        open={feedback !== null}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        status={feedback?.status}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
};

export default EmailLogPage;
