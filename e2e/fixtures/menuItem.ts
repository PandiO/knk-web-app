import type { MockApi } from '../support/mockApi';
import type {
  GameSettingsDto,
  GameSettingsUpdateDto,
  MenuItemSettingsDto,
} from '../../src/types/dtos/gameSettings/GameSettingsModels';
import { gameSettings } from './territory';

/**
 * The menu item section as the API seeds it (PandiO/knk-workspace#870, knk-web-api `MenuItemSettings.Defaults`):
 * today's `menus.menu-item.*` keys with every click opening `main`, plus the siege overrides of DESIGN § 4.3.4.
 */
export const seededMenuItem: MenuItemSettingsDto = {
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
  clicks: {
    LEFT_CLICK: { type: 'OpenMenu', menuKey: 'main' },
    RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'main' },
    SHIFT_LEFT_CLICK: { type: 'OpenMenu', menuKey: 'main' },
    SHIFT_RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'main' },
    INVENTORY_CLICK: { type: 'OpenMenu', menuKey: 'main' },
  },
  overrides: {
    'siege.hub': {
      LEFT_CLICK: { type: 'OpenMenu', menuKey: 'siege.information' },
      RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'siege.information' },
    },
    'siege.match': {
      LEFT_CLICK: { type: 'OpenMenu', menuKey: 'siege.information' },
      RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'siege.information' },
      SHIFT_RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'siege.shop' },
    },
    'siege.survival.match': {
      LEFT_CLICK: { type: 'OpenMenu', menuKey: 'siege.information' },
      RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'siege.information' },
      SHIFT_RIGHT_CLICK: { type: 'OpenMenu', menuKey: 'siege.shop' },
    },
  },
};

/** Game settings with the seeded menu item. */
export const menuItemGameSettings: GameSettingsDto = { ...gameSettings, menuItem: seededMenuItem };

/** GET answers the settings; PUT answers what was sent, as the API does after a good save. */
export function mockMenuItemGameSettings(api: MockApi) {
  api.json<GameSettingsDto>('GET', /^GameSettings\/?$/, menuItemGameSettings);
  api.on<GameSettingsDto>('PUT', /^GameSettings\/?$/, ({ body }) => ({
    body: { ...menuItemGameSettings, ...(body as GameSettingsUpdateDto), updatedAt: '2026-11-20T12:00:00Z' } as GameSettingsDto,
  }));
}
