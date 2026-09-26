import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Coins, Settings } from 'lucide-react';
import { BalanceLedgerTable } from '../../components/currency/BalanceLedgerTable';
import { usePermission } from '../../hooks/useStaffAccess';
import { CURRENCY_NODES } from '../../types/dtos/currency/CurrencyDtos';

/**
 * Moderation → Balance event log (KNG-23, currency-payments Phase 4): every change to any
 * player's coins, gems and XP, for tracing mistakes, abuse and test runs. Staff only
 * (knk.admin.currency.history, a StaffRoute node); a row's transaction can be reversed from its
 * detail page.
 */
export const BalanceLogPage: React.FC = () => {
    const { allowed: canEditPolicy } = usePermission(CURRENCY_NODES.policy);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <Link to="/admin/users" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Player moderation
                        </Link>
                        <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                            <Coins className="h-6 w-6 mr-2" />
                            Balance event log
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Every change to players&apos; coins, gems and XP, with the balance before and after, who or what
                            made it and why. Click a column to sort; open a transaction to see all of it or reverse it.
                        </p>
                    </div>
                    {canEditPolicy && (
                        <Link to="/admin/economy/policy" className="btn-secondary text-sm">
                            <Settings className="h-4 w-4 mr-2" />
                            Currency policy
                        </Link>
                    )}
                </div>
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                    <BalanceLedgerTable pageSize={50} />
                </div>
            </div>
        </div>
    );
};

export default BalanceLogPage;
