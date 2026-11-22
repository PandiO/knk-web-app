/**
 * PandiO/knk-workspace#180: the world task types the form builder offers, only those the game server has a handler for
 * (knk-plugin: WorldTaskHandlerRegistry for player tasks, HeadlessWorldTaskPoller for scans). A type without a handler
 * used to leave the claimed task InProgress for good; the plugin now fails it, but the builder shouldn't offer it.
 *
 * ReagionCreate (sic, the seeded spelling) and RegionClaim run the region handler. Since PandiO/knk-workspace#944 the
 * plugin finds it by task type (ReagionCreate, RegionCreate, RegionClaim), so they work on any field, such as the
 * Landmark form's RegionId; older plugins found it only through the field name WgRegionId.
 *
 * The SiegeWeaponSpot type (#799) is gone since PandiO/knk-workspace#988: the weapon spot form draws its region with
 * ReagionCreate on WgRegionId like any other region field.
 */
export const WORLD_TASK_TYPES_WITH_HANDLER: readonly string[] = [
    'LocationSelection',
    'ReagionCreate',
    'RegionClaim',
    'ItemScan',
    'KitScan',
    'GateBlockScan',
    'GateOpenedBlockScan',
];

/** #180: the type a field gets when "Requires in-game action" is turned on (was VerifyLocation, which has no handler). */
export const DEFAULT_WORLD_TASK_TYPE = 'LocationSelection';

export function hasWorldTaskHandler(taskType?: string | null): boolean {
    return !!taskType && WORLD_TASK_TYPES_WITH_HANDLER.includes(taskType);
}
