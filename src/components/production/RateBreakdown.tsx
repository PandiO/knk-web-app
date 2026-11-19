import React from 'react';
import { AppliedModifierDto } from '../../types/dtos/production/ProductionEngineDtos';
import { formatRate, rateSteps } from '../../utils/productionEngine';

interface Props {
    /** The table's accessible name. */
    label: string;
    baseRatePerHour: number;
    modifiers: AppliedModifierDto[];
    unlockFactor: number;
    workerFactor: number;
    /** The API's effective rate, shown as the result. */
    effectiveRatePerHour: number;
}

/**
 * A line's or cycle's rate formula step by step (PandiO/knk-workspace#678, acceptance A08): the base rate, each modifier
 * in the order the API applied it (additions, then multiplications), the unlock and the workers present. The result row
 * is the API's effective rate.
 */
export const RateBreakdown: React.FC<Props> = ({ label, baseRatePerHour, modifiers, unlockFactor, workerFactor, effectiveRatePerHour }) => {
    const steps = rateSteps({ baseRatePerHour, modifiers, unlockFactor, workerFactor });
    return (
        <table className="text-sm" aria-label={label}>
            <thead>
                <tr className="text-left text-muted">
                    <th className="py-0.5 pr-4 font-medium">Step</th>
                    <th className="py-0.5 pr-4 font-medium">Change</th>
                    <th className="py-0.5 pr-4 font-medium">Rate</th>
                </tr>
            </thead>
            <tbody>
                {steps.map((step, index) => (
                    <tr key={`${index}-${step.label}`}>
                        <td className="py-0.5 pr-4">{step.label}</td>
                        <td className="py-0.5 pr-4">{step.change}</td>
                        <td className="py-0.5 pr-4">{formatRate(step.rate)}</td>
                    </tr>
                ))}
                <tr className="border-t border-line font-medium">
                    <td className="py-0.5 pr-4">Effective rate</td>
                    <td className="py-0.5 pr-4" />
                    <td className="py-0.5 pr-4">{formatRate(effectiveRatePerHour)}</td>
                </tr>
            </tbody>
        </table>
    );
};

export default RateBreakdown;
