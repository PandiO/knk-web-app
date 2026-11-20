import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { transportOrderClient } from '../../../apiClients/transportOrderClient';
import { Pager } from '../../../components/Pager';
import { TransportOrderTable } from '../../../components/transport/TransportOrderTable';
import { useActionGate } from '../../../hooks/useActionGate';
import { TRANSPORT_ORIGINS, TRANSPORT_STATUSES, TransportOrderListDto } from '../../../types/dtos/production/TransportDtos';
import { productionRefusalReason } from '../../../utils/productionEngine';
import { buildReturnTo, withReturnTo } from '../../../utils/returnTo';
import {
    NEW_TRANSPORT_ORDER_PATH,
    OrderFilterKey,
    TRANSPORT_WRITE_NODE,
    ordersPath,
    readOrderFilters,
    transportStatusLabel,
} from '../../../utils/transport';

const PAGE_SIZE = 25;

const ID_FIELDS: { key: OrderFilterKey; label: string; help: string }[] = [
    { key: 'structureId', label: 'Structure id', help: 'Source, stop or carrier.' },
    { key: 'storageId', label: 'Storage id', help: 'Source or any stop.' },
];

/**
 * Transport orders (PandiO/knk-workspace#682; production DESIGN § 7, § 11.1, acceptance A12, insight #65): newest first,
 * filtered by status, origin, open or final, structure and storage (the filters live in the URL, so a structure page can
 * link to its orders). Each row opens the order's page (timeline, cargo, route). Staff with knk.admin.world get
 * "New manual order".
 */
export const TransportOrdersPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const here = buildReturnTo(location);
    const writeGate = useActionGate(TRANSPORT_WRITE_NODE);
    const filters = useMemo(() => readOrderFilters(searchParams), [searchParams]);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const [draft, setDraft] = useState(filters);
    const [rows, setRows] = useState<TransportOrderListDto[] | null>(null);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => setDraft(filters), [filters]);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        const query: Record<string, string> = {};
        Object.entries(filters).forEach(([key, value]) => { if (value) query[key] = value; });
        transportOrderClient.search({ pageNumber: page, pageSize: PAGE_SIZE, sortDescending: true, filters: query })
            .then(result => {
                if (cancelled) return;
                setRows(result.items ?? []);
                setTotal(result.totalCount ?? 0);
            })
            .catch(err => {
                if (!cancelled) setError(productionRefusalReason(err) ?? "Couldn't load the orders.");
            });
        return () => { cancelled = true; };
    }, [filters, page]);

    const go = (next: Partial<Record<OrderFilterKey, string>>, nextPage = 1) => {
        const path = ordersPath(next);
        navigate(nextPage > 1 ? `${path}${path.includes('?') ? '&' : '?'}page=${nextPage}` : path);
    };

    const apply = (e: React.FormEvent) => {
        e.preventDefault();
        go(draft);
    };

    const set = (key: OrderFilterKey, value: string) => setDraft(d => ({ ...d, [key]: value }));

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center text-2xl font-bold text-fg">
                        <Truck className="mr-2 h-6 w-6" aria-hidden="true" />
                        Transport orders
                    </h1>
                    <p className="mt-1 text-sm text-muted">
                        Goods on their way from producers to warehouses: automatic orders from the trigger and manual ones by staff.
                        Open an order for its timeline, cargo and route.
                    </p>
                </div>
                {writeGate.allowed && (
                    <Link to={withReturnTo(NEW_TRANSPORT_ORDER_PATH, here)} className="btn-primary text-sm">New manual order</Link>
                )}
            </div>

            <form className="panel grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Order filters" onSubmit={apply}>
                <div>
                    <label htmlFor="orders-open" className="mb-1 block text-sm font-medium text-fg">Open or final</label>
                    <select id="orders-open" className="input w-full px-3 py-2" value={draft.open ?? ''} onChange={e => set('open', e.target.value)}>
                        <option value="">Any</option>
                        <option value="true">Open</option>
                        <option value="false">Final</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="orders-status" className="mb-1 block text-sm font-medium text-fg">Status</label>
                    <select id="orders-status" className="input w-full px-3 py-2" value={draft.status ?? ''} onChange={e => set('status', e.target.value)}>
                        <option value="">Any</option>
                        {TRANSPORT_STATUSES.map(status => <option key={status} value={status}>{transportStatusLabel(status)}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="orders-origin" className="mb-1 block text-sm font-medium text-fg">Origin</label>
                    <select id="orders-origin" className="input w-full px-3 py-2" value={draft.origin ?? ''} onChange={e => set('origin', e.target.value)}>
                        <option value="">Any</option>
                        {TRANSPORT_ORIGINS.map(origin => <option key={origin} value={origin}>{origin}</option>)}
                    </select>
                </div>
                {ID_FIELDS.map(field => (
                    <div key={field.key}>
                        <label htmlFor={`orders-${field.key}`} className="mb-1 block text-sm font-medium text-fg">{field.label}</label>
                        <input id={`orders-${field.key}`} className="input w-full px-3 py-2" inputMode="numeric" value={draft[field.key] ?? ''}
                            onChange={e => set(field.key, e.target.value)} />
                        <p className="mt-1 text-xs text-muted">{field.help}</p>
                    </div>
                ))}
                <div className="flex items-end gap-2 lg:col-span-5">
                    <button type="submit" className="btn-primary text-sm">Apply filters</button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => go({})}>Clear</button>
                </div>
            </form>

            <section className="panel p-4" aria-label="Orders">
                {error && <p className="text-sm field-error" role="alert">{error}</p>}
                {!error && rows == null && <p className="text-sm text-muted">Loading the orders…</p>}
                {!error && rows != null && (
                    <>
                        <TransportOrderTable orders={rows} returnTo={here} label="Transport orders" empty="No orders match the filters." />
                        <Pager page={page} pageSize={PAGE_SIZE} totalCount={total} noun="orders" className="mt-3"
                            onPageChange={next => go(filters, next)} />
                    </>
                )}
            </section>
        </div>
    );
};

export default TransportOrdersPage;
