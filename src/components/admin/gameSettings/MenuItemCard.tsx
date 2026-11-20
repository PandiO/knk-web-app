import React from 'react';
import {
    MenuItemActionDto,
    MenuItemActionType,
    MenuItemClickTable,
    MenuItemSettingsDto,
} from '../../../types/dtos/gameSettings/GameSettingsModels';
import {
    MENU_ITEM_ACTIONS,
    MENU_ITEM_CLICKS,
    MENU_ITEM_LIMITS,
    MENU_ITEM_SITUATIONS,
    SUGGESTED_MENU_KEYS,
    menuItemSettingsErrors,
} from '../../../utils/menuItemSettings';
import { MinecraftLegacyPreview } from './MinecraftLegacyPreview';

interface MenuItemCardProps {
    value: MenuItemSettingsDto;
    changed?: boolean;
    onChange: (value: MenuItemSettingsDto) => void;
}

/** "Use default" in an override table: the click is left out and the default table decides. */
const USE_DEFAULT = '';

interface ClickTableProps {
    table: MenuItemClickTable;
    /** Prefix of every control's accessible name, e.g. "Siege match: ". */
    prefix: string;
    /** Override tables offer "Use default" (the click is left out). */
    partial: boolean;
    onChange: (table: MenuItemClickTable) => void;
}

const ClickTable: React.FC<ClickTableProps> = ({ table, prefix, partial, onChange }) => {
    const setAction = (click: string, action: MenuItemActionDto | null) => {
        const next = { ...table };
        if (action) next[click] = action;
        else delete next[click];
        onChange(next);
    };
    const changeType = (click: string, type: string) => {
        if (type === USE_DEFAULT) {
            setAction(click, null);
            return;
        }
        const current = table[click];
        if (type === 'OpenMenu') setAction(click, { type, menuKey: current?.menuKey ?? 'main' });
        else if (type === 'RunCommand') setAction(click, { type, command: current?.command ?? '' });
        else setAction(click, { type: type as MenuItemActionType });
    };

    return (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted">
                    <th scope="col" className="py-1 pr-3 font-medium">Click</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Action</th>
                    <th scope="col" className="py-1 font-medium">Menu key or command</th>
                </tr>
            </thead>
            <tbody>
                {MENU_ITEM_CLICKS.map(click => {
                    const action = table[click.key];
                    const type = action?.type ?? (partial ? USE_DEFAULT : 'None');
                    return (
                        <tr key={click.key} className="border-t border-line">
                            <th scope="row" className="py-1 pr-3 font-normal text-fg">{click.label}</th>
                            <td className="py-1 pr-3">
                                <select
                                    aria-label={`${prefix}${click.label} action`}
                                    value={type}
                                    onChange={e => changeType(click.key, e.target.value)}
                                    className="input px-2 py-1"
                                >
                                    {partial && <option value={USE_DEFAULT}>Use default</option>}
                                    {MENU_ITEM_ACTIONS.map(a => <option key={a.type} value={a.type}>{a.label}</option>)}
                                </select>
                            </td>
                            <td className="py-1">
                                {action?.type === 'OpenMenu' && (
                                    <input
                                        aria-label={`${prefix}${click.label} menu key`}
                                        list="menu-item-menu-keys"
                                        value={action.menuKey ?? ''}
                                        maxLength={MENU_ITEM_LIMITS.maxMenuKeyLength}
                                        onChange={e => setAction(click.key, { type: 'OpenMenu', menuKey: e.target.value })}
                                        className="input px-2 py-1 font-mono"
                                    />
                                )}
                                {action?.type === 'RunCommand' && (
                                    <input
                                        aria-label={`${prefix}${click.label} command`}
                                        placeholder="siege shop"
                                        value={action.command ?? ''}
                                        maxLength={MENU_ITEM_LIMITS.maxCommandLength}
                                        onChange={e => setAction(click.key, { type: 'RunCommand', command: e.target.value })}
                                        className="input px-2 py-1 font-mono"
                                    />
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        </div>
    );
};

const Check: React.FC<{ label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, hint, checked, onChange }) => (
    <label className="flex items-start gap-2 text-sm text-fg">
        <input type="checkbox" className="mt-1" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span>
            <span className="font-medium">{label}</span>
            <span className="block text-xs text-muted">{hint}</span>
        </span>
    </label>
);

/**
 * Game settings section `menuItem` (PandiO/knk-workspace#870, siege shop DESIGN § 4.3): the menu item's look (today's
 * `menus.menu-item.*` keys), one action per click and partial click tables per situation. The game server applies a
 * save within seconds; its `config.yml` keys are only the fallback when the API is down at startup.
 */
export const MenuItemCard: React.FC<MenuItemCardProps> = ({ value, changed, onChange }) => {
    const set = (patch: Partial<MenuItemSettingsDto>) => onChange({ ...value, ...patch });
    const errors = menuItemSettingsErrors(value);
    const missingSituations = MENU_ITEM_SITUATIONS.filter(s => !(s.key in value.overrides));
    const [toAdd, setToAdd] = React.useState('');
    const addKey = missingSituations.some(s => s.key === toAdd) ? toAdd : missingSituations[0]?.key ?? '';

    const setOverride = (situation: string, table: MenuItemClickTable) => set({ overrides: { ...value.overrides, [situation]: table } });
    const removeOverride = (situation: string) => {
        const next = { ...value.overrides };
        delete next[situation];
        set({ overrides: next });
    };
    // Known situations in the plugin's order (most specific first), then any the API knows and this page does not.
    const overrideKeys = [
        ...MENU_ITEM_SITUATIONS.map(s => s.key).filter(k => k in value.overrides),
        ...Object.keys(value.overrides).filter(k => !MENU_ITEM_SITUATIONS.some(s => s.key === k)),
    ];

    return (
        <section className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-4" aria-labelledby="menu-item-heading">
            <h2 id="menu-item-heading" className="text-lg font-semibold text-fg">
                Menu item{changed ? <span className="ml-2 text-xs font-normal text-muted">(changed)</span> : null}
            </h2>
            <p className="text-sm text-muted">
                The item players click to open the menus (the nether star). It never drops on the ground, never goes into
                {' '}containers and can't be placed. A save reaches online players within seconds, in the same slot; the
                {' '}plugin's <code>menus.menu-item</code> keys in <code>config.yml</code> are only used when the API is down
                {' '}at startup.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Check label="Menu item enabled" hint="Off: nobody gets the item." checked={value.enabled} onChange={enabled => set({ enabled })} />
                <Check label="Give on join" hint="Put it back at every join when it is missing." checked={value.giveOnJoin} onChange={giveOnJoin => set({ giveOnJoin })} />
                <Check label="Keep on death" hint="Give it back at respawn." checked={value.keepOnDeath} onChange={keepOnDeath => set({ keepOnDeath })} />
                <Check label="Droppable" hint="Dropping takes it away until the next join or respawn." checked={value.droppable} onChange={droppable => set({ droppable })} />
                <Check label="Movable" hint="It may be moved in the player's own inventory; inventory clicks then do nothing." checked={value.movable} onChange={movable => set({ movable })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="menu-item-give-to" className="block text-sm font-medium text-fg mb-1">Who gets it</label>
                    <select id="menu-item-give-to" value={value.giveTo} onChange={e => set({ giveTo: e.target.value })} className="input px-3 py-2">
                        <option value="all">All players</option>
                        <option value="bedrock">Bedrock players only</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="menu-item-material" className="block text-sm font-medium text-fg mb-1">Material</label>
                    <input
                        id="menu-item-material"
                        value={value.material}
                        onChange={e => set({ material: e.target.value })}
                        className="input px-3 py-2 font-mono"
                    />
                    <p className="mt-1 text-xs text-muted">A material name such as <code>NETHER_STAR</code> or <code>COMPASS</code>.</p>
                </div>
                <div>
                    <label htmlFor="menu-item-slot" className="block text-sm font-medium text-fg mb-1">Slot</label>
                    <input
                        id="menu-item-slot"
                        type="number"
                        min={0}
                        max={MENU_ITEM_LIMITS.maxSlot}
                        value={Number.isNaN(value.slot) ? '' : value.slot}
                        onChange={e => set({ slot: e.target.value.trim() === '' ? Number.NaN : Number(e.target.value) })}
                        className="input px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-muted">0-8 hotbar (8 = right-most), 9-35 main inventory.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="menu-item-name" className="block text-sm font-medium text-fg mb-1">Name</label>
                    <input
                        id="menu-item-name"
                        value={value.name}
                        maxLength={MENU_ITEM_LIMITS.maxNameLength}
                        onChange={e => set({ name: e.target.value })}
                        className="input px-3 py-2 font-mono"
                    />
                </div>
                <div>
                    <label htmlFor="menu-item-lore" className="block text-sm font-medium text-fg mb-1">Lore (one line per row)</label>
                    <textarea
                        id="menu-item-lore"
                        rows={2}
                        value={value.lore.join('\n')}
                        onChange={e => set({ lore: e.target.value === '' ? [] : e.target.value.split('\n') })}
                        className="input px-3 py-2 font-mono"
                    />
                </div>
            </div>
            <div className="rounded-md border border-line bg-surface-alt p-2" data-testid="menu-item-preview">
                <p className="text-xs text-muted mb-1">Preview</p>
                <MinecraftLegacyPreview dark text={[value.name, ...value.lore].join('\n')} />
            </div>

            <datalist id="menu-item-menu-keys">
                {SUGGESTED_MENU_KEYS.map(key => <option key={key} value={key} />)}
            </datalist>

            <div className="space-y-1">
                <h3 className="text-base font-semibold text-fg">Clicks</h3>
                <p className="text-xs text-muted">
                    What each click does everywhere else. Open menu takes a menu key such as <code>main</code>,
                    {' '}<code>siege.information</code> or <code>siege.shop</code>; Run command a player command without the slash.
                </p>
                <ClickTable table={value.clicks} prefix="" partial={false} onChange={clicks => set({ clicks })} />
            </div>

            <div className="space-y-3">
                <h3 className="text-base font-semibold text-fg">Situation overrides</h3>
                <p className="text-xs text-muted">
                    In a situation, a click set here replaces the default; "Use default" keeps the click above. The most specific
                    {' '}situation wins: Siege Survival match, then Siege match, then Siege hub.
                </p>
                {overrideKeys.map(situation => {
                    const known = MENU_ITEM_SITUATIONS.find(s => s.key === situation);
                    const label = known?.label ?? situation;
                    return (
                        <div key={situation} className="rounded-md border border-line p-3 space-y-1" role="group" aria-label={`${label} override`}>
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-fg">
                                    {label} <code className="text-xs text-muted">{situation}</code>
                                    {known && <span className="block text-xs font-normal text-muted">{known.hint}</span>}
                                </p>
                                <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => removeOverride(situation)}>
                                    Remove {label}
                                </button>
                            </div>
                            <ClickTable
                                table={value.overrides[situation]}
                                prefix={`${label}: `}
                                partial
                                onChange={table => setOverride(situation, table)}
                            />
                        </div>
                    );
                })}
                {missingSituations.length > 0 && (
                    <div className="flex flex-wrap items-end gap-2">
                        <div>
                            <label htmlFor="menu-item-add-situation" className="block text-sm font-medium text-fg mb-1">Situation</label>
                            <select id="menu-item-add-situation" value={addKey} onChange={e => setToAdd(e.target.value)} className="input px-3 py-2">
                                {missingSituations.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </div>
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => addKey && setOverride(addKey, {})}>
                            Add override
                        </button>
                    </div>
                )}
            </div>

            {errors.length > 0 && (
                <div role="alert">
                    <ul className="text-sm field-error" aria-label="Menu item problems">
                        {errors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                </div>
            )}
        </section>
    );
};

export default MenuItemCard;
