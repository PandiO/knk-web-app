import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Pause, Play, RefreshCw, RotateCcw, Send, Ticket, Users, X, XCircle } from 'lucide-react';
import { invitationClient } from '../../apiClients/invitationClient';
import { FeedbackModal } from '../../components/FeedbackModal';
import {
  INVITATION_STATUSES,
  InvitationDto,
  InvitationKind,
  InvitationOptionsDto,
  InvitationPageDto,
  InvitationRedemptionDto,
  InvitationStatus,
  PersonalInvitationResultDto,
  SharedInvitationResultDto,
  SKIP_REASONS,
} from '../../types/dtos/invitations/InvitationDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

const PAGE_SIZE = 25;

const STATUS_PILL: Record<InvitationStatus, string> = {
  Active: 'bg-green-100 text-green-800',
  Paused: 'bg-amber-100 text-amber-800',
  Exhausted: 'bg-slate-200 text-slate-700',
  Expired: 'bg-slate-200 text-slate-700',
  Revoked: 'bg-red-100 text-red-800',
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

type Feedback = { title: string; message: string; status: 'success' | 'error' | 'info' };
type RowAction = 'resend' | 'rotate' | 'pause' | 'resume' | 'revoke';
type Pending = { action: RowAction; item: InvitationDto };

/** What was just created, shown once: the links and codes are never shown again. */
type Created =
  | { kind: 'Personal'; results: PersonalInvitationResultDto[] }
  | { kind: 'Shared'; result: SharedInvitationResultDto };

const CONFIRM: Record<RowAction, { title: string; message: string; label: string; danger?: boolean }> = {
  resend: { title: 'Resend this invitation?', message: 'A new link is mailed and the expiry starts again. The old link stops working.', label: 'Resend' },
  rotate: { title: 'Rotate this code?', message: 'A new code replaces this one; uses so far are kept. The old code and link stop working right away.', label: 'Rotate' },
  pause: { title: 'Pause this code?', message: 'Nobody can sign up with it until you resume it.', label: 'Pause' },
  resume: { title: 'Resume this code?', message: 'Sign-ups with it work again until it expires or runs out of uses.', label: 'Resume' },
  revoke: { title: 'Revoke this invitation?', message: 'It stops working for good. Accounts already created with it stay.', label: 'Revoke', danger: true },
};

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
      aria-label={label}>
      <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

/**
 * Invitations for the closed alpha (KNG-212, knk-workspace docs/specs/invitations/DESIGN.md § 3.6):
 * personal invites by email (bulk) and shared codes, a result panel with the links shown once, the
 * list with status pills and row actions, and who redeemed each one. Needs knk.admin.invites.
 */
export const InvitationsPage: React.FC = () => {
  const [tab, setTab] = useState<InvitationKind>('Personal');
  const [options, setOptions] = useState<InvitationOptionsDto | null>(null);
  const [page, setPage] = useState<InvitationPageDto | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [status, setStatus] = useState<InvitationStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [drawer, setDrawer] = useState<{ item: InvitationDto; rows: InvitationRedemptionDto[] | null; error?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPage(await invitationClient.list({ pageNumber, pageSize: PAGE_SIZE, status, kind: tab }));
    } catch (err) {
      setLoadError(apiRefusalReason(err) ?? 'Could not load the invitations.');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, status, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    invitationClient.options().then(setOptions).catch(() => setOptions(null));
  }, []);

  const runAction = async ({ action, item }: Pending) => {
    setBusy(true);
    try {
      if (action === 'resend') {
        const result = await invitationClient.resend(item.id);
        setCreated({ kind: 'Personal', results: [result] });
      } else if (action === 'rotate') {
        setCreated({ kind: 'Shared', result: await invitationClient.rotate(item.id) });
      } else if (action === 'pause') {
        await invitationClient.pause(item.id);
      } else if (action === 'resume') {
        await invitationClient.resume(item.id);
      } else {
        await invitationClient.revoke(item.id);
      }
      await load();
    } catch (err) {
      setFeedback({ title: `${CONFIRM[action].label} failed`, message: apiRefusalReason(err) ?? 'The action could not be completed.', status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const openRedemptions = async (item: InvitationDto) => {
    setDrawer({ item, rows: null });
    try {
      setDrawer({ item, rows: await invitationClient.redemptions(item.id) });
    } catch (err) {
      setDrawer({ item, rows: [], error: apiRefusalReason(err) ?? 'Could not load the redemptions.' });
    }
  };

  const totalPages = page ? Math.max(1, Math.ceil(page.totalCount / page.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Ticket className="h-6 w-6" /> Invitations
          </h1>
          <p className="text-sm text-slate-600">
            Personal invites go to one email address and work once. Shared codes are for a group, with a use cap. Links and codes are shown once.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading}
          className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {options && options.registrationMode !== 'Invite' && options.registrationMode !== 'Open' && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="mode-warning">
          Sign-up with invitations is off on this server (Security:Registration:Mode is {options.registrationMode}). You can create
          invitations now, but they can only be used once the mode is Invite.
        </div>
      )}

      <div role="tablist" className="flex gap-2 border-b border-slate-200">
        {(['Personal', 'Shared'] as InvitationKind[]).map(kind => (
          <button key={kind} type="button" role="tab" aria-selected={tab === kind}
            onClick={() => { setTab(kind); setPageNumber(1); setCreated(null); }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === kind ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            {kind === 'Personal' ? 'Personal invites' : 'Shared codes'}
          </button>
        ))}
      </div>

      {tab === 'Personal'
        ? <PersonalCreateCard options={options} busy={busy} setBusy={setBusy}
            onCreated={results => { setCreated({ kind: 'Personal', results }); load(); }} onError={setFeedback} />
        : <SharedCreateCard options={options} busy={busy} setBusy={setBusy}
            onCreated={result => { setCreated({ kind: 'Shared', result }); load(); }} onError={setFeedback} />}

      {created && <CreatedPanel created={created} onClose={() => setCreated(null)} />}

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Status
          <select aria-label="Status" value={status} className="rounded border border-slate-300 px-2 py-1"
            onChange={e => { setStatus(e.target.value as InvitationStatus | ''); setPageNumber(1); }}>
            <option value="">All</option>
            {INVITATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {loadError && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</div>}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{tab === 'Personal' ? 'Email' : 'Label'}</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Uses</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Created by</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && !page && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {page && page.items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No invitations.</td></tr>
            )}
            {page?.items.map(item => (
              <tr key={item.id} className="border-t border-slate-100 align-top" data-testid={`invitation-row-${item.id}`}>
                <td className="px-3 py-2">
                  <div>{item.kind === 'Personal' ? item.email : item.label}</div>
                  <div className="font-mono text-xs text-slate-500">…{item.codeHint}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[item.status] ?? 'bg-slate-100'}`}>{item.status}</span>
                </td>
                <td className="px-3 py-2">{item.useCount} / {item.maxUses}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(item.expiresAt)}</td>
                <td className="px-3 py-2">{item.groupName ?? '-'}</td>
                <td className="px-3 py-2">{item.createdByName ?? `#${item.createdByUserId}`}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.kind === 'Personal' && item.status !== 'Revoked' && item.status !== 'Exhausted' && (
                      <RowButton label="Resend" Icon={Send} disabled={busy} onClick={() => setPending({ action: 'resend', item })} />
                    )}
                    {item.kind === 'Shared' && item.status !== 'Revoked' && (
                      <RowButton label="Rotate" Icon={RotateCcw} disabled={busy} onClick={() => setPending({ action: 'rotate', item })} />
                    )}
                    {item.kind === 'Shared' && item.status === 'Active' && (
                      <RowButton label="Pause" Icon={Pause} disabled={busy} onClick={() => setPending({ action: 'pause', item })} />
                    )}
                    {item.kind === 'Shared' && item.status === 'Paused' && (
                      <RowButton label="Resume" Icon={Play} disabled={busy} onClick={() => setPending({ action: 'resume', item })} />
                    )}
                    {item.status !== 'Revoked' && (
                      <RowButton label="Revoke" Icon={XCircle} disabled={busy} onClick={() => setPending({ action: 'revoke', item })} />
                    )}
                    {item.useCount > 0 && (
                      <RowButton label="Redemptions" Icon={Users} onClick={() => openRedemptions(item)} />
                    )}
                  </div>
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

      {drawer && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl"
          role="dialog" aria-label="Redemptions">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Redemptions</h2>
            <button type="button" onClick={() => setDrawer(null)} aria-label="Close redemptions" className="rounded p-1 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-600">{drawer.item.kind === 'Personal' ? drawer.item.email : drawer.item.label}</p>
          {drawer.error && <p className="mt-3 text-sm text-red-700">{drawer.error}</p>}
          {drawer.rows === null && <p className="mt-3 text-sm text-slate-500">Loading…</p>}
          {drawer.rows && drawer.rows.length === 0 && !drawer.error && <p className="mt-3 text-sm text-slate-500">Nobody has used it yet.</p>}
          <ul className="mt-3 divide-y divide-slate-100">
            {drawer.rows?.map(row => (
              <li key={row.userId} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{row.minecraftLinked ? row.username : row.emailMasked ?? row.username}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${row.minecraftLinked ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {row.minecraftLinked ? 'Linked' : 'Not linked yet'}
                  </span>
                </div>
                <div className="text-xs text-slate-500">#{row.userId} · {row.emailMasked ?? 'no email'} · {formatDateTime(row.redeemedAt)}</div>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <FeedbackModal
        open={pending !== null}
        status={pending && CONFIRM[pending.action].danger ? 'error' : 'info'}
        title={pending ? CONFIRM[pending.action].title : ''}
        message={pending ? CONFIRM[pending.action].message : ''}
        continueLabel={pending ? CONFIRM[pending.action].label : undefined}
        danger={pending ? CONFIRM[pending.action].danger : false}
        onContinue={() => { if (pending) void runAction(pending); }}
        onClose={() => setPending(null)}
      />

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

const RowButton: React.FC<{ label: string; Icon: React.ComponentType<{ className?: string }>; onClick: () => void; disabled?: boolean }> =
  ({ label, Icon, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">
      <Icon className="h-3 w-3" /> {label}
    </button>
  );

interface CreateCardProps<T> {
  options: InvitationOptionsDto | null;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCreated: (result: T) => void;
  onError: (feedback: Feedback) => void;
}

const GroupSelect: React.FC<{ id: string; options: InvitationOptionsDto | null; value: string; onChange: (value: string) => void }> =
  ({ id, options, value, onChange }) => (
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
      <option value="">No group</option>
      {options?.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );

const PersonalCreateCard: React.FC<CreateCardProps<PersonalInvitationResultDto[]>> = ({ options, busy, setBusy, onCreated, onError }) => {
  const [emails, setEmails] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [groupId, setGroupId] = useState('');
  const [note, setNote] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = emails.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (list.length === 0) {
      onError({ title: 'No addresses', message: 'Enter at least one email address, one per line.', status: 'error' });
      return;
    }
    setBusy(true);
    try {
      const response = await invitationClient.createPersonal({
        emails: list,
        expiryDays: expiryDays ? Number(expiryDays) : undefined,
        groupId: groupId ? Number(groupId) : null,
        note: note.trim() || undefined,
        sendEmail,
      });
      setEmails('');
      setNote('');
      onCreated(response.results);
    } catch (err) {
      onError({ title: 'Invitations not created', message: apiRefusalReason(err) ?? 'Could not create the invitations.', status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2" aria-label="Create personal invites">
      <div className="sm:col-span-2">
        <label htmlFor="personal-emails" className="block text-sm font-medium text-slate-700">Email addresses (one per line)</label>
        <textarea id="personal-emails" rows={3} value={emails} onChange={e => setEmails(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="tester@example.com" />
      </div>
      <div>
        <label htmlFor="personal-expiry" className="block text-sm font-medium text-slate-700">Expires after (days)</label>
        <input id="personal-expiry" type="number" min={1} max={options?.maxExpiryDays ?? 30} value={expiryDays}
          placeholder={String(options?.defaultExpiryDays ?? 7)} onChange={e => setExpiryDays(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label htmlFor="personal-group" className="block text-sm font-medium text-slate-700">Group on sign-up</label>
        <div className="mt-1"><GroupSelect id="personal-group" options={options} value={groupId} onChange={setGroupId} /></div>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="personal-note" className="block text-sm font-medium text-slate-700">Note (for staff, not mailed)</label>
        <input id="personal-note" type="text" maxLength={500} value={note} onChange={e => setNote(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
        Send the invitation email (off: just give me the links)
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          Create invites
        </button>
      </div>
    </form>
  );
};

const SharedCreateCard: React.FC<CreateCardProps<SharedInvitationResultDto>> = ({ options, busy, setBusy, onCreated, onError }) => {
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [groupId, setGroupId] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      onError({ title: 'Label required', message: 'Give the code a label, so a leaked code can be traced (for example "Discord #announcements 21 Oct").', status: 'error' });
      return;
    }
    setBusy(true);
    try {
      const result = await invitationClient.createShared({
        label: label.trim(),
        maxUses: maxUses ? Number(maxUses) : undefined,
        expiryDays: expiryDays ? Number(expiryDays) : undefined,
        groupId: groupId ? Number(groupId) : null,
      });
      setLabel('');
      onCreated(result);
    } catch (err) {
      onError({ title: 'Code not created', message: apiRefusalReason(err) ?? 'Could not create the code.', status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2" aria-label="Create shared code">
      <div className="sm:col-span-2">
        <label htmlFor="shared-label" className="block text-sm font-medium text-slate-700">Label</label>
        <input id="shared-label" type="text" maxLength={120} value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Discord #announcements 21 Oct" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label htmlFor="shared-uses" className="block text-sm font-medium text-slate-700">Max uses</label>
        <input id="shared-uses" type="number" min={1} max={options?.sharedMaxUsesCap ?? 50} value={maxUses}
          placeholder={String(options?.sharedDefaultMaxUses ?? 5)} onChange={e => setMaxUses(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label htmlFor="shared-expiry" className="block text-sm font-medium text-slate-700">Expires after (days)</label>
        <input id="shared-expiry" type="number" min={1} max={options?.maxExpiryDays ?? 30} value={expiryDays}
          placeholder={String(options?.defaultExpiryDays ?? 7)} onChange={e => setExpiryDays(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label htmlFor="shared-group" className="block text-sm font-medium text-slate-700">Group on sign-up</label>
        <div className="mt-1"><GroupSelect id="shared-group" options={options} value={groupId} onChange={setGroupId} /></div>
      </div>
      <div className="flex items-end justify-end">
        <button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          Create code
        </button>
      </div>
    </form>
  );
};

const CreatedPanel: React.FC<{ created: Created; onClose: () => void }> = ({ created, onClose }) => (
  <section className="rounded border border-blue-200 bg-blue-50 p-4 text-sm" aria-label="Created invitations" data-testid="created-panel">
    <div className="flex items-start justify-between gap-2">
      <p className="font-medium text-blue-900">Copy what you need now: links and codes are not shown again.</p>
      <button type="button" onClick={onClose} aria-label="Hide links" className="rounded p-1 hover:bg-blue-100"><X className="h-4 w-4" /></button>
    </div>
    {created.kind === 'Shared' ? (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base" data-testid="shared-code">{created.result.code}</span>
          <CopyButton value={created.result.code} label="Copy code" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-all font-mono text-xs">{created.result.link}</span>
          <CopyButton value={created.result.link} label="Copy link" />
        </div>
      </div>
    ) : (
      <ul className="mt-3 space-y-2">
        {created.results.map((r, i) => (
          <li key={`${r.email}-${i}`} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.email}</span>
            {r.outcome === 'Created' && r.link ? (
              <>
                <CopyButton value={r.link} label={`Copy link for ${r.email}`} />
                <span className="text-xs text-slate-600">
                  {r.mailStatus === 'Suppressed'
                    ? 'Mail held back by the throttle - send the link yourself'
                    : r.mailStatus ? `Mail ${r.mailStatus.toLowerCase()}` : 'No mail sent'}
                  {r.replacedInvitationId ? ' · replaced an older invite' : ''}
                </span>
              </>
            ) : (
              <span className="text-xs text-red-700">Skipped: {SKIP_REASONS[r.reason ?? ''] ?? r.reason}</span>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default InvitationsPage;
