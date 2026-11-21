import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import { shopClient } from '../../apiClients/shopClient';
import { shopCatalogueEntryClient } from '../../apiClients/shopCatalogueEntryClient';
import { stockTransactionClient } from '../../apiClients/stockTransactionClient';
import { townAccountClient } from '../../apiClients/townAccountClient';
import { useActionGate } from '../../hooks/useActionGate';
import type { ShopCatalogueEntryListDto, ShopDto, ShopOfferDto, TownAccountDto } from '../../types/dtos/production/ShopDtos';
import type { StockTransactionListDto } from '../../types/dtos/stock/StockDtos';
import { formatDateTime } from '../../utils/format';
import { formatNumber, productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { SHOP_NODE, SHOP_PAGE_MAX, formatCoins, priceSourceLabel, reasonLabel } from '../../utils/shops';
import { ShopCatalogueEditor } from './ShopCatalogueEditor';
import { ShopTradeStatsPanel } from './ShopTradeStatsPanel';

interface Props {
    shopId: number;
    returnTo: string | null;
    refreshKey?: number;
    onChanged?: () => void;
}

/** The ledger's source type of a shop's stock transactions (knk-web-api `ShopTradingService.StockSourceType`). */
const SHOP_SOURCE_TYPE = 'Shop';
const SALES_PAGE = 20;

const isNotFound = (err: unknown) => (err as { status?: number } | null)?.status === 404;

/**
 * A shop (PandiO/knk-workspace#688; shops DESIGN § 2-4, § 9, acceptance A18): its kind, type, level, prices and worker;
 * the town account its income goes to; the live offer (what players see now, sold out greyed); the catalogue editor; the
 * sales and buy-backs (the stock ledger filtered by the shop); the hourly trade stats as a chart. Storages, processing
 * lines and restocking are the production structure panels below (a shop is one underneath). World area only.
 */
export const ShopPanel: React.FC<Props> = ({ shopId, returnTo, refreshKey, onChanged }) => {
    const gate = useActionGate(SHOP_NODE);
    const [shop, setShop] = useState<ShopDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [offer, setOffer] = useState<ShopOfferDto | null>(null);
    const [offerError, setOfferError] = useState<string | null>(null);
    const [entries, setEntries] = useState<ShopCatalogueEntryListDto[] | null>(null);
    const [account, setAccount] = useState<TownAccountDto | null | 'none'>(null);
    const [sales, setSales] = useState<StockTransactionListDto[] | null>(null);
    const [salesTotal, setSalesTotal] = useState(0);
    const [salesPage, setSalesPage] = useState(1);
    const [notice, setNotice] = useState<string | null>(null);

    const loadOffer = useCallback(async () => {
        setOfferError(null);
        try {
            setOffer(await shopClient.getOffer(shopId));
        } catch (err) {
            setOffer(null);
            setOfferError(productionRefusalReason(err) ?? "Couldn't load the offer.");
        }
    }, [shopId]);

    const loadEntries = useCallback(async () => {
        try {
            const page = await shopCatalogueEntryClient.search({ pageNumber: 1, pageSize: SHOP_PAGE_MAX, filters: { shopId: String(shopId) } });
            setEntries(page.items ?? []);
        } catch {
            setEntries(null);
        }
    }, [shopId]);

    const load = useCallback(async () => {
        setError(null);
        let dto: ShopDto;
        try {
            dto = await shopClient.getById(shopId);
            setShop(dto);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the shop.");
            return;
        }
        void loadOffer();
        void loadEntries();
        if (dto.effectiveTownId != null) {
            try {
                setAccount(await townAccountClient.getByTown(dto.effectiveTownId));
            } catch (err) {
                setAccount(isNotFound(err) ? 'none' : null);
            }
        } else {
            setAccount('none');
        }
    }, [shopId, loadOffer, loadEntries]);

    const loadSales = useCallback(async (page: number) => {
        try {
            const result = await stockTransactionClient.searchTransactions({
                pageNumber: page, pageSize: SALES_PAGE, filters: { sourceType: SHOP_SOURCE_TYPE, sourceRef: String(shopId) },
            });
            setSales(result.items ?? []);
            setSalesTotal(result.totalCount ?? 0);
        } catch {
            setSales(null);
        }
    }, [shopId]);

    useEffect(() => {
        if (gate.allowed) void load();
    }, [gate.allowed, load, refreshKey]);

    useEffect(() => {
        if (gate.allowed) void loadSales(salesPage);
    }, [gate.allowed, loadSales, salesPage, refreshKey]);

    if (!gate.allowed) return null;

    const catalogueChanged = (message: string) => {
        setNotice(message);
        void loadEntries();
        void loadOffer();
        onChanged?.();
    };

    const salesPages = Math.max(1, Math.ceil(salesTotal / SALES_PAGE));

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="shop-panel-heading" data-testid="shop-panel">
            <h2 id="shop-panel-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Store className="mr-2 h-5 w-5" aria-hidden="true" />
                Shop
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !shop && <p className="text-sm text-muted">Loading the shop…</p>}
            {notice && <p className="mb-3 text-sm text-fg" role="status">{notice}</p>}
            {shop && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3" aria-label="Shop summary">
                        <div><dt className="text-muted">Kind</dt>
                            <dd data-testid="shop-kind">{shop.kind === 'Processing' ? 'Processing (Input → Merchandise, then sells)' : 'Trading (sells goods as they are)'}</dd></div>
                        <div><dt className="text-muted">Shop type and level</dt>
                            <dd data-testid="shop-type-level">
                                {shop.shopType
                                    ? <Link to={displayPath('ShopType', shop.shopType.id, returnTo)} className="text-primary hover:underline">{shop.shopType.name}</Link>
                                    : 'No shop type'}
                                {`, level ${shop.level ?? 1}`}
                            </dd></div>
                        <div><dt className="text-muted">Prices</dt>
                            <dd data-testid="shop-prices">{`tax × ${formatNumber(shop.taxModifier ?? 1, 3)}, buys back at ${formatNumber(shop.buyBackPercent ?? 50, 2)}%`}</dd></div>
                        <div><dt className="text-muted">Worker</dt>
                            <dd data-testid="shop-worker">
                                {(shop.workersTotal ?? 0) > 0
                                    ? `${shop.workersPresent ?? 0} of ${shop.workersTotal} present${(shop.workersPresent ?? 0) < (shop.workersTotal ?? 0) ? ': away restocking, processing is lowered (selling goes on)' : ''}`
                                    : 'No worker: nobody collects the restock'}
                            </dd></div>
                        <div><dt className="text-muted">Storages</dt>
                            <dd data-testid="shop-storages">
                                {(shop.storages ?? []).length === 0 ? 'None' : (shop.storages ?? []).map((storage, i) => (
                                    <React.Fragment key={storage.id}>
                                        {i > 0 && ', '}
                                        <Link to={displayPath('Storage', storage.id, returnTo)} className="text-primary hover:underline">{storage.name ?? `#${storage.id}`}</Link>
                                        {storage.purpose ? ` (${storage.purpose})` : ''}
                                    </React.Fragment>
                                ))}
                            </dd></div>
                        <div><dt className="text-muted">Town account</dt>
                            <dd data-testid="shop-town-account">
                                {shop.effectiveTownId == null && 'No town: the shop has no account to pay into'}
                                {shop.effectiveTownId != null && account === null && "Couldn't load the town's account"}
                                {shop.effectiveTownId != null && account === 'none' && 'No account yet: it opens with the first sale'}
                                {account && account !== 'none' && (
                                    <>
                                        <Link to={displayPath('TownAccount', account.id, returnTo)} className="text-primary hover:underline">
                                            {account.town?.name ?? `Town #${account.townId}`}: {formatCoins(account.coins)}
                                        </Link>
                                        {!account.reconciled && <span className="text-warning-strong"> (does not match its ledger)</span>}
                                    </>
                                )}
                            </dd></div>
                    </dl>

                    <h3 className="mt-6 mb-1 text-base font-semibold text-fg">Offer now</h3>
                    {offerError && <p className="text-sm field-error" role="alert">{offerError}</p>}
                    {offer && (
                        <>
                            <p className="mb-2 text-xs text-muted" data-testid="shop-offer-summary">
                                {`What players see in the shop menu${offer.hideSoldOut ? '; sold-out items are hidden' : '; sold-out items are greyed out'}. `}
                                {offer.buysFromPlayers ? 'It buys from players in its accepted categories.' : 'It buys nothing from players now (production off, or no accepted categories).'}
                            </p>
                            {offer.items.length === 0 ? <p className="text-sm text-muted">Nothing on offer.</p> : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-sm" aria-label="Offer">
                                        <thead>
                                            <tr className="text-muted">
                                                <th className="pr-4 font-medium">Item</th><th className="pr-4 font-medium">Price</th>
                                                <th className="pr-4 font-medium">From</th><th className="pr-4 font-medium">Stock</th>
                                                <th className="font-medium">Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {offer.items.map(item => (
                                                <tr key={`${item.catalogueEntryId ?? 'stock'}-${item.itemBlueprintId}-${item.itemInstanceId ?? ''}`}
                                                    className={`border-t border-line ${item.soldOut ? 'text-muted line-through' : ''}`}>
                                                    <td className="pr-4 py-1">
                                                        {item.itemBlueprintName}
                                                        {item.enchantments && item.enchantments.length > 0 && ` (${item.enchantments.join(', ')})`}
                                                    </td>
                                                    <td className="pr-4 py-1">{item.unitPrice != null ? formatCoins(item.unitPrice) : '-'}</td>
                                                    <td className="pr-4 py-1">{priceSourceLabel(item.priceSource)}</td>
                                                    <td className="pr-4 py-1">{item.stock == null ? 'Unlimited' : item.stock}</td>
                                                    <td className="py-1">
                                                        {[item.soldOut ? 'Sold out' : null, item.pinned ? 'Pinned' : null,
                                                            item.catalogueEntryId == null ? (item.itemInstanceId != null ? 'Bought back, resold as this item' : 'In stock, no entry') : null]
                                                            .filter(Boolean).join('; ') || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                    <ShopCatalogueEditor shopId={shopId} entries={entries} onChanged={catalogueChanged} />

                    <h3 className="mt-6 mb-1 text-base font-semibold text-fg">Sales and buy-backs</h3>
                    <p className="mb-2 text-xs text-muted">The stock ledger of this shop, newest first; the coins are in the town account's ledger.</p>
                    {sales == null && <p className="text-sm text-muted">Couldn't load the sales.</p>}
                    {sales != null && sales.length === 0 && <p className="text-sm text-muted">No sales or buy-backs yet.</p>}
                    {sales != null && sales.length > 0 && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm" aria-label="Sales and buy-backs">
                                    <thead>
                                        <tr className="text-muted">
                                            <th className="pr-4 font-medium">Transaction</th><th className="pr-4 font-medium">When</th>
                                            <th className="pr-4 font-medium">What</th><th className="pr-4 font-medium">Units</th>
                                            <th className="font-medium">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sales.map(tx => (
                                            <tr key={tx.id} className="border-t border-line">
                                                <td className="pr-4 py-1">
                                                    <Link to={displayPath('StockTransaction', tx.id, returnTo)} className="text-primary hover:underline">#{tx.id}</Link>
                                                </td>
                                                <td className="pr-4 py-1">{formatDateTime(tx.createdAt)}</td>
                                                <td className="pr-4 py-1">{tx.reason === 'ShopSale' ? 'Sale' : tx.reason === 'ShopBuyBack' ? 'Buy-back' : reasonLabel(tx.reason)}</td>
                                                <td className="pr-4 py-1">{tx.totalAmount}</td>
                                                <td className="py-1">{tx.note ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {salesPages > 1 && (
                                <div className="mt-2 flex items-center gap-2 text-sm">
                                    <button type="button" className="btn-secondary text-xs" disabled={salesPage <= 1} onClick={() => setSalesPage(p => p - 1)}>Newer</button>
                                    <span>Page {salesPage} of {salesPages}</span>
                                    <button type="button" className="btn-secondary text-xs" disabled={salesPage >= salesPages} onClick={() => setSalesPage(p => p + 1)}>Older</button>
                                </div>
                            )}
                        </>
                    )}

                    <ShopTradeStatsPanel shopId={shopId} refreshKey={refreshKey} />
                </>
            )}
        </section>
    );
};

export default ShopPanel;
