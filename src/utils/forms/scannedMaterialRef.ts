import { minecraftMaterialRefClient } from '../../apiClients/minecraftMaterialRefClient';
import { MinecraftMaterialRefDto } from '../../types/dtos/minecraftMaterialRef/MinecraftMaterialRefDto';

/**
 * KNG-200 phase 5: the saved MinecraftMaterialRef for a material an in-game ItemScan or KitScan
 * reported (e.g. "minecraft:diamond_sword"), through `POST api/MinecraftMaterialRefs/get-or-create`.
 * Get-or-create finds the row the server scan saved (it normalises the key); the category `ITEM`
 * only matters when the key is not in the catalogue yet and a new Unverified row is created.
 *
 * Resolves to null for a blank material or `minecraft:air` (an empty slot, which the catalogue
 * excludes). Errors from the API are passed on, so each caller logs them in its own words.
 */
export async function resolveScannedMaterialRef(material: unknown): Promise<MinecraftMaterialRefDto | null> {
    if (typeof material !== 'string') return null;
    const key = material.trim();
    if (!key || key.toLowerCase() === 'minecraft:air' || key.toLowerCase() === 'air') return null;
    return minecraftMaterialRefClient.persistFromCatalog(key, 'ITEM');
}
