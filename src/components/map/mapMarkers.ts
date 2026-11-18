import type { MapConfigDto, MapMarkersDto, MapOutlineDto, MapPinDto } from '../../types/dtos/map/MapDtos';
import { BridgeMarkers, BridgeOutline, BridgePin, BridgeRegion, MapEntityKind, regionKey } from './bridgeProtocol';

/**
 * Turns `GET api/Map/markers` into the bridge's `setMarkers` payload (OVERVIEW_MAP_DESIGN § 5 rules 3–5, O04, O05,
 * O18–O20). Engine-neutral: no BlueMap types here, the bridge script draws it.
 */

/** Outline points are inclusive block coordinates; the line runs through the block centres (L2 note: +0.5). */
export function toBridgeOutline(outline: MapOutlineDto): BridgeOutline {
  return {
    points: outline.points.map(([x, z]) => [x + 0.5, z + 0.5] as [number, number]),
    minY: outline.minY,
    maxY: outline.maxY,
  };
}

function pin(kind: MapEntityKind, id: number, label: string, at: MapPinDto, maxDistance: number | null,
  sublabel?: string | null): BridgePin {
  return { kind, id, label, sublabel: sublabel ?? null, world: at.world, x: at.x, y: at.y, z: at.z, maxDistance };
}

function region(kind: MapEntityKind, id: number, label: string, world: string, outlines: MapOutlineDto[]): BridgeRegion {
  return { key: regionKey(kind, id), kind, id, label, world, outlines: outlines.map(toBridgeOutline) };
}

export function toBridgeMarkers(markers: MapMarkersDto, labels: MapConfigDto['labels']): BridgeMarkers {
  const pins: BridgePin[] = [];
  const regions: BridgeRegion[] = [];
  markers.towns.forEach(town => {
    pins.push(pin('town', town.id, town.name, town.pin, labels.town));
    if (town.outlines.length > 0) regions.push(region('town', town.id, town.name, town.pin.world, town.outlines));
  });
  markers.districts.forEach(district => {
    pins.push(pin('district', district.id, district.name, district.pin, labels.district));
    if (district.outlines.length > 0) {
      regions.push(region('district', district.id, district.name, district.pin.world, district.outlines));
    }
  });
  markers.structures.forEach(structure => {
    pins.push(pin('structure', structure.id, structure.name, structure.pin, labels.structure, structure.typeLabel));
    if (structure.outlines.length > 0) {
      regions.push(region('structure', structure.id, structure.name, structure.pin.world, structure.outlines));
    }
  });
  return { version: markers.version, pins, regions };
}

/** The regions the town toggle shows: the town and every district of it (O05, O30: all at once, no fade-in). */
export function townRegionKeys(markers: MapMarkersDto, townId: number): string[] {
  return [
    regionKey('town', townId),
    ...markers.districts.filter(district => district.townId === townId).map(district => regionKey('district', district.id)),
  ];
}
