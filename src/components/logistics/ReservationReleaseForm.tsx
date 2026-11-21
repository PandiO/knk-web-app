import React, { useId, useState } from 'react';
import { logisticsReservationClient } from '../../apiClients/logisticsReservationClient';
import { LogisticsReservationDto } from '../../types/dtos/production/LogisticsDtos';
import { productionRefusalReason } from '../../utils/productionEngine';

interface Props {
    reservationId: number;
    onReleased: (reservation: LogisticsReservationDto) => void;
    onCancel: () => void;
}

/**
 * Releasing an open reservation (PandiO/knk-workspace#686; `POST api/LogisticsReservations/{id}/release`): says what
 * happens first, takes an optional reason, and shows the API's refusal (409 once the collection order has loaded).
 */
export const ReservationReleaseForm: React.FC<Props> = ({ reservationId, onReleased, onCancel }) => {
    const reasonId = useId();
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const release = async () => {
        setBusy(true);
        setError(null);
        try {
            onReleased(await logisticsReservationClient.release(reservationId, { reason: reason.trim() || null }));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't release the reservation.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div role="group" aria-label={`Release reservation #${reservationId}`} className="mt-3 space-y-2 rounded border border-warning-line bg-warning-muted p-3 text-sm">
            <p className="text-warning-strong">
                Releasing reservation #{reservationId} ends it Cancelled with its collection order; the stock is free again for
                the next planner run. A reservation whose order has loaded can't be released.
            </p>
            <label htmlFor={reasonId} className="block text-sm font-medium text-fg">Reason (optional)</label>
            <input id={reasonId} className="input px-3 py-2" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} />
            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void release()}>
                    {busy ? 'Releasing…' : 'Release now'}
                </button>
                <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={onCancel}>Keep it</button>
            </div>
            {error && <p className="field-error" role="alert">{error}</p>}
        </div>
    );
};

export default ReservationReleaseForm;
