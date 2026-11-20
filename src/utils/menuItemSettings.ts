import {
  MenuItemActionDto,
  MenuItemActionType,
  MenuItemClickTable,
  MenuItemSettingsDto,
} from '../types/dtos/gameSettings/GameSettingsModels';

/**
 * The menu item section of the game settings (PandiO/knk-workspace#870, siege shop DESIGN § 4.3). The lists and limits
 * mirror knk-web-api `Services/MenuItemSettings.cs`; the API checks them again on save.
 */

/** The click types, in the order the card lists them. */
export const MENU_ITEM_CLICKS: Array<{ key: string; label: string }> = [
  { key: 'LEFT_CLICK', label: 'Left click' },
  { key: 'RIGHT_CLICK', label: 'Right click' },
  { key: 'SHIFT_LEFT_CLICK', label: 'Shift + left click' },
  { key: 'SHIFT_RIGHT_CLICK', label: 'Shift + right click' },
  { key: 'INVENTORY_CLICK', label: 'Click in the inventory' },
];

/** The situations the plugin registers (P26), most specific first (§ 5.7.1). */
export const MENU_ITEM_SITUATIONS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'siege.survival.match', label: 'Siege Survival match', hint: 'member of a running Survival match' },
  { key: 'siege.match', label: 'Siege match', hint: 'member of a running PvP match' },
  { key: 'siege.hub', label: 'Siege hub', hint: 'in a siege hub or team split' },
];

export const MENU_ITEM_ACTIONS: Array<{ type: MenuItemActionType; label: string }> = [
  { type: 'OpenMenu', label: 'Open menu' },
  { type: 'RunCommand', label: 'Run command' },
  { type: 'None', label: 'Nothing' },
];

/** Menu keys offered in the picker; any other template key can be typed. */
export const SUGGESTED_MENU_KEYS = ['main', 'siege.information', 'siege.shop', 'siege.overview'];

export const MENU_ITEM_LIMITS = {
  maxSlot: 35,
  maxNameLength: 256,
  maxLoreLines: 20,
  maxLoreLineLength: 256,
  maxMenuKeyLength: 100,
  maxCommandLength: 256,
};

const MATERIAL_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const MENU_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

const openMenu = (menuKey: string): MenuItemActionDto => ({ type: 'OpenMenu', menuKey });

const matchOverride = (): MenuItemClickTable => ({
  LEFT_CLICK: openMenu('siege.information'),
  RIGHT_CLICK: openMenu('siege.information'),
  SHIFT_RIGHT_CLICK: openMenu('siege.shop'),
});

/** The API's seeded defaults (today's `menus.menu-item.*` keys plus the § 4.3.4 siege overrides). */
export const defaultMenuItemSettings = (): MenuItemSettingsDto => ({
  enabled: true,
  giveTo: 'all',
  giveOnJoin: true,
  keepOnDeath: true,
  material: 'NETHER_STAR',
  name: '&6&lMenu &7(click to open)',
  lore: ['&7Opens the Knights & Kings menu (&e/menu&7).'],
  slot: 8,
  droppable: false,
  movable: false,
  clicks: Object.fromEntries(MENU_ITEM_CLICKS.map(c => [c.key, openMenu('main')])),
  overrides: {
    'siege.hub': { LEFT_CLICK: openMenu('siege.information'), RIGHT_CLICK: openMenu('siege.information') },
    'siege.match': matchOverride(),
    'siege.survival.match': matchOverride(),
  },
});

/** Fills what an older API leaves out, so the card always has every field. */
export const normalizeMenuItemSettings = (value?: Partial<MenuItemSettingsDto> | null): MenuItemSettingsDto => {
  if (!value) return defaultMenuItemSettings();
  const defaults = defaultMenuItemSettings();
  return {
    ...defaults,
    ...value,
    lore: value.lore ?? [],
    clicks: value.clicks ?? {},
    overrides: value.overrides ?? {},
  } as MenuItemSettingsDto;
};

const situationLabel = (key: string) => MENU_ITEM_SITUATIONS.find(s => s.key === key)?.label ?? key;
const clickLabel = (key: string) => MENU_ITEM_CLICKS.find(c => c.key === key)?.label ?? key;

const actionErrors = (action: MenuItemActionDto, where: string): string[] => {
  if (action.type === 'OpenMenu') {
    const key = (action.menuKey ?? '').trim();
    if (!key) return [`${where}: Open menu needs a menu key.`];
    if (key.length > MENU_ITEM_LIMITS.maxMenuKeyLength || !MENU_KEY_PATTERN.test(key)) {
      return [`${where}: "${key}" is not a menu key (lower case letters, digits, ".", "_" and "-", such as siege.shop).`];
    }
  }
  if (action.type === 'RunCommand') {
    const command = (action.command ?? '').trim().replace(/^\/+/, '').trim();
    if (!command) return [`${where}: Run command needs a command.`];
    if (command.length > MENU_ITEM_LIMITS.maxCommandLength) {
      return [`${where}: the command is longer than ${MENU_ITEM_LIMITS.maxCommandLength} characters.`];
    }
  }
  return [];
};

const tableErrors = (table: MenuItemClickTable, prefix: string): string[] =>
  MENU_ITEM_CLICKS.flatMap(c => (table[c.key] ? actionErrors(table[c.key], `${prefix}${clickLabel(c.key)}`) : []));

/** What the API would refuse, as sentences for the card; empty = fine to save. */
export const menuItemSettingsErrors = (value: MenuItemSettingsDto): string[] => {
  const errors: string[] = [];
  if (!MATERIAL_PATTERN.test((value.material ?? '').trim().toUpperCase())) {
    errors.push('Material must be a material name such as NETHER_STAR.');
  }
  if ((value.name ?? '').trim().length > MENU_ITEM_LIMITS.maxNameLength) {
    errors.push(`The name is longer than ${MENU_ITEM_LIMITS.maxNameLength} characters.`);
  }
  if (value.lore.length > MENU_ITEM_LIMITS.maxLoreLines) {
    errors.push(`The lore has at most ${MENU_ITEM_LIMITS.maxLoreLines} lines.`);
  }
  if (value.lore.some(line => line.length > MENU_ITEM_LIMITS.maxLoreLineLength)) {
    errors.push(`A lore line is longer than ${MENU_ITEM_LIMITS.maxLoreLineLength} characters.`);
  }
  if (!Number.isInteger(value.slot) || value.slot < 0 || value.slot > MENU_ITEM_LIMITS.maxSlot) {
    errors.push(`Slot must be 0 to ${MENU_ITEM_LIMITS.maxSlot}.`);
  }
  errors.push(...tableErrors(value.clicks, ''));
  Object.entries(value.overrides).forEach(([situation, table]) => {
    errors.push(...tableErrors(table, `${situationLabel(situation)}, `));
  });
  return errors;
};

/** The settings as the API stores them: lore lines trimmed at the end, empty overrides dropped. */
export const menuItemSettingsPayload = (value: MenuItemSettingsDto): MenuItemSettingsDto => ({
  ...value,
  material: value.material.trim().toUpperCase(),
  lore: value.lore.map(line => line.trimEnd()),
  overrides: Object.fromEntries(Object.entries(value.overrides).filter(([, table]) => Object.keys(table).length > 0)),
});
