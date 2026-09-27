import React from 'react';
import { Gift } from 'lucide-react';
import { LootboxSettingsTab } from '../../components/lootbox/LootboxSettingsTab';
import { LootboxTypesTab } from '../../components/lootbox/LootboxTypesTab';
import { LootboxSpecialsTab } from '../../components/lootbox/LootboxSpecialsTab';
import { LootboxAreasTab } from '../../components/lootbox/LootboxAreasTab';
import { LootboxOddsTab } from '../../components/lootbox/LootboxOddsTab';
import { LootboxActiveTab } from '../../components/lootbox/LootboxActiveTab';
import { LootboxDropLogTab } from '../../components/lootbox/LootboxDropLogTab';
import { LootboxTokensTab } from '../../components/lootbox/LootboxTokensTab';

/**
 * Lootboxes Phase 4 (docs/specs/lootboxes/DESIGN.md §3.6, IMPLEMENTATION_PLAN.md Phase 4): the admin
 * page for world lootboxes, behind knk.admin.lootbox.manage (see the /admin/lootboxes route; the API
 * enforces the node on every call too). Types, specials and areas are FormWizard entities - their
 * tabs list them and link to the forms - while the settings singleton, the odds preview, the active
 * boxes, the token items (Phase 5: issued tokens, revoke, premium tier / kit grant rules) and the drop
 * log live here.
 */

type TabKey = 'settings' | 'types' | 'specials' | 'areas' | 'odds' | 'active' | 'tokens' | 'log';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'settings', label: 'Settings' },
    { key: 'types', label: 'Types' },
    { key: 'specials', label: 'Specials' },
    { key: 'areas', label: 'Areas' },
    { key: 'odds', label: 'Odds' },
    { key: 'active', label: 'Active boxes' },
    { key: 'tokens', label: 'Token items' },
    { key: 'log', label: 'Drop log' },
];

export const LootboxesPage: React.FC<{ initialTab?: TabKey }> = ({ initialTab = 'types' }) => {
    const [tab, setTab] = React.useState<TabKey>(initialTab);
    const [oddsTypeId, setOddsTypeId] = React.useState<number | null>(null);

    const showOdds = (typeId: number) => {
        setOddsTypeId(typeId);
        setTab('odds');
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Gift className="h-6 w-6 mr-2" /> Lootboxes
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                    World boxes, one type per item category, rolled by the API when a player opens one.
                </p>
            </div>

            <div role="tablist" aria-label="Lootbox sections" className="flex flex-wrap gap-1 border-b border-gray-200">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t.key ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel">
                {tab === 'settings' && <LootboxSettingsTab />}
                {tab === 'types' && <LootboxTypesTab onShowOdds={showOdds} />}
                {tab === 'specials' && <LootboxSpecialsTab />}
                {tab === 'areas' && <LootboxAreasTab />}
                {tab === 'odds' && <LootboxOddsTab typeId={oddsTypeId} onTypeChange={setOddsTypeId} />}
                {tab === 'active' && <LootboxActiveTab />}
                {tab === 'tokens' && <LootboxTokensTab />}
                {tab === 'log' && <LootboxDropLogTab />}
            </div>
        </div>
    );
};

export default LootboxesPage;
