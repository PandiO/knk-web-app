import React from 'react';
import { Loader2, Lock, Unlock } from 'lucide-react';
import { siegeWeaponUnlockClient } from '../../apiClients/siegeWeaponUnlockClient';
import type {
  SiegeWeaponUnlockOfferDto,
  SiegeWeaponUnlocksOverviewDto,
} from '../../types/dtos/siege/SiegeWeaponUnlockDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

// Siege shop L4 (knk-workspace docs/specs/siege-shop/DESIGN.md § 4.2.2, P08, P09; A27; PandiO/knk-workspace#869): the
// Siege unlocks panel on the player's own account page, the same list and button as the in-game menu (main menu →
// Siege Minigame → Siege unlocks). A siege weapon type is unlocked once with coins (and an optional minimum title) to
// be allowed to buy it in siege matches. Unlocking asks for a confirmation; the API charges once per type, so a double
// click charges once.

function stateText(offer: SiegeWeaponUnlockOfferDto, coins: number): string {
  switch (offer.state) {
    case 'Unlocked':
      return 'Unlocked';
    case 'NeedsTitle':
      return `Needs title ${offer.minTitleName ?? ''}`.trim();
    case 'NeedsCoins':
      return `Not enough coins: ${coins}/${offer.unlockPrice}`;
    default:
      return `Unlock for ${offer.unlockPrice} coins`;
  }
}

export const MySiegeUnlocksSection: React.FC = () => {
  const [overview, setOverview] = React.useState<SiegeWeaponUnlocksOverviewDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const [buying, setBuying] = React.useState(false);
  // The state lags a render behind a fast double click; the ref doesn't, so the second click sends nothing.
  const inFlight = React.useRef(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    siegeWeaponUnlockClient.getMine()
      .then((result) => { if (!cancelled) setOverview(result); })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load siege unlocks:', err);
        setError('Could not load your siege unlocks.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => load(), [load]);

  const unlock = async (offer: SiegeWeaponUnlockOfferDto) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBuying(true);
    setNotice(null);
    try {
      const result = await siegeWeaponUnlockClient.purchase(offer.templateId);
      setNotice({
        ok: true,
        text: result.alreadyUnlocked
          ? `You have already unlocked the ${result.templateName}.`
          : `Unlocked the ${result.templateName}${result.coinsPaid > 0 ? ` for ${result.coinsPaid} coins` : ''}. You can buy it in siege matches now.`,
      });
    } catch (err) {
      setNotice({ ok: false, text: apiRefusalReason(err) ?? 'The unlock did not go through. Reload the list and try again.' });
    } finally {
      inFlight.current = false;
      setBuying(false);
      setConfirming(null);
      load();
    }
  };

  return (
    <section className="border-b pb-6" aria-labelledby="siege-unlocks-heading">
      <h2 id="siege-unlocks-heading" className="text-lg font-semibold text-fg flex items-center mb-2">
        <Unlock className="h-5 w-5 mr-2" aria-hidden="true" />
        Siege unlocks
      </h2>
      <p className="text-sm text-muted mb-4">
        Unlock a siege weapon type once with coins to buy it in siege matches. Unlocks can&apos;t be bought in game during a match.
      </p>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={`text-sm mb-3 ${notice.ok ? 'text-success' : 'text-danger'}`}>
          {notice.text}
        </p>
      )}
      {loading && !overview ? (
        <div className="flex items-center text-sm text-muted">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : error || !overview ? (
        <p className="field-error text-sm">{error ?? 'Could not load your siege unlocks.'}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-fg">
            Coins: <span className="font-semibold">{overview.coins}</span>
            {overview.titleName && <> &middot; Your title: <span className="font-semibold">{overview.titleName}</span></>}
          </p>
          {overview.offers.length === 0 ? (
            <p className="text-sm text-muted">There are no siege weapons to unlock yet.</p>
          ) : (
            <ul className="divide-y divide-line" aria-label="Siege weapon types">
              {overview.offers.map((offer) => (
                <li
                  key={offer.templateId}
                  aria-label={offer.name}
                  className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-fg flex items-center">
                      {offer.state === 'Unlocked'
                        ? <Unlock className="h-4 w-4 mr-1 text-success" aria-hidden="true" />
                        : <Lock className="h-4 w-4 mr-1 text-muted" aria-hidden="true" />}
                      {offer.name}
                    </p>
                    <p className="text-xs text-muted">
                      {offer.unlockPrice} coins &middot; minimum title: {offer.minTitleName ?? 'none'}
                    </p>
                  </div>
                  {offer.state === 'Unlockable' ? (
                    confirming === offer.templateId ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => unlock(offer)}
                          disabled={buying}
                          className="px-3 py-1.5 rounded-lg bg-success text-white font-medium hover:bg-success-strong disabled:opacity-50"
                        >
                          Confirm: unlock for {offer.unlockPrice} coins
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          disabled={buying}
                          className="px-3 py-1.5 rounded-lg border border-line text-fg hover:bg-surface-alt disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setNotice(null); setConfirming(offer.templateId); }}
                        disabled={buying}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-medium hover:bg-primary-dark disabled:opacity-50"
                      >
                        {stateText(offer, overview.coins)}
                      </button>
                    )
                  ) : (
                    <span className={`text-xs font-medium ${offer.state === 'Unlocked' ? 'text-success' : 'text-danger'}`}>
                      {stateText(offer, overview.coins)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
