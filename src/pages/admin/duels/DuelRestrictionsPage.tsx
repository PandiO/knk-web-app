import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ban } from 'lucide-react';
import { DuelRestrictionsPanel } from '../../../components/admin/DuelRestrictionsPanel';
import { usePageTitle } from '../../../hooks/usePageTitle';

/**
 * Staff → Duels → Restrictions (arena duels P7, KNG-221, DESIGN §10.3 / §13.3): every duel restriction —
 * a player, or one pair, barred from value-moving duels until an optional end date — with add and lift.
 * The same list, filtered to the player, is on their staff profile. Needs knk.admin.duel.review.
 */
export const DuelRestrictionsPage: React.FC = () => {
    usePageTitle('Duel restrictions');
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <Link to="/admin/duels" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Duels
                    </Link>
                    <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                        <Ban className="h-6 w-6 mr-2" />
                        Duel restrictions
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        For a suspected alt pair, or a player farming value through duels. Abuse across the economy (duels plus
                        payments and trading) is what the currency transfer lock is for; serious cheating is for a freeze.
                    </p>
                </div>
                <DuelRestrictionsPanel />
            </div>
        </div>
    );
};

export default DuelRestrictionsPage;
