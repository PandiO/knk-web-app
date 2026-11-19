/**
 * PandiO/knk-workspace#180: the world task types the form builder offers, only those the game server has a handler for
 * (knk-plugin: WorldTaskHandlerRegistry for player tasks, HeadlessWorldTaskPoller for scans). A type without a handler
 * used to leave the claimed task InProgress for good; the plugin now fails it, but the builder shouldn't offer it.
 *
 * ReagionCreate (sic, the seeded spelling) and RegionClaim run the region handler, which the plugin finds through the
 * field name WgRegionId, so use them on a WgRegionId field.
 *
 * SiegeWeaponSpot (#799) fills a whole weapon spot form (bounds, facing, size class, region); the spot seed puts it on
 * MinX, a field with no handler of its own.
 */
export const WORLD_TASK_TYPES_WITH_HANDLER: readonly string[] = [
    'LocationSelection',
    'ReagionCreate',
    'RegionClaim',
    'ItemScan',
    'KitScan',
    'GateBlockScan',
    'GateOpenedBlockScan',
    // PandiO/knk-workspace#799: weapon spot capture; the plugin handles it only with siege.weapons.enabled.
    'SiegeWeaponSpot',
];

/** #180: the type a field gets when "Requires in-game action" is turned on (was VerifyLocation, which has no handler). */
export const DEFAULT_WORLD_TASK_TYPE = 'LocationSelection';

export function hasWorldTaskHandler(taskType?: string | null): boolean {
    return !!taskType && WORLD_TASK_TYPES_WITH_HANDLER.includes(taskType);
}
