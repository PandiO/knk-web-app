import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The bridge's region geometry (#826): `public/bluemap-bridge/bridge.js` is a plain script for BlueMap's web app, so the
 * suite runs the real file and reads the pure helpers it exposes as `window.__knkBridgeGeometry`. The drawing itself is
 * covered by e2e `overview-map.spec.ts` against the fake BlueMap.
 */

type Point = [number, number];
interface BridgeGeometry {
  simplifyOutline(points: Point[]): Point[];
  pointInPolygon(x: number, z: number, points: Point[]): boolean;
  clampVolume(minY: number, maxY: number): { minY: number; maxY: number };
  districtHoles(townPoints: Point[], world: string, regions: unknown[]): Point[][];
}

let geometry: BridgeGeometry;

beforeAll(() => {
  jest.useFakeTimers(); // the bridge waits for BlueMap with setTimeout; there is no BlueMap here
  const source = readFileSync(join(__dirname, '../../../../public/bluemap-bridge/bridge.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(source)();
  geometry = (window as unknown as { __knkBridgeGeometry: BridgeGeometry }).__knkBridgeGeometry;
});

afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const square = (x: number, z: number, size: number): Point[] => [[x, z], [x + size, z], [x + size, z + size], [x, z + size]];

describe('simplifyOutline', () => {
  it('drops points on a straight line between their neighbours', () => {
    const jagged: Point[] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5]];
    expect(geometry.simplifyOutline(jagged)).toEqual(square(0, 0, 10));
  });

  it('drops a straight-line point at the start, diagonal ones and repeated points', () => {
    const outline: Point[] = [[5, 0.5], [10.5, 0.5], [10.5, 10.5], [5.5, 5.5], [0.5, 0.5], [0.5, 0.5]];
    expect(geometry.simplifyOutline(outline)).toEqual([[10.5, 0.5], [10.5, 10.5], [0.5, 0.5]]);
  });

  it('keeps every real corner and never goes below three points', () => {
    const lShape: Point[] = [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]];
    expect(geometry.simplifyOutline(lShape)).toEqual(lShape);
    expect(geometry.simplifyOutline([[0, 0], [1, 0], [2, 0]])).toHaveLength(3);
  });

  it('does not change its input', () => {
    const input: Point[] = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]];
    geometry.simplifyOutline(input);
    expect(input).toHaveLength(5);
  });
});

describe('pointInPolygon', () => {
  it('tells inside from outside, also in an L shape', () => {
    const lShape: Point[] = [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]];
    expect(geometry.pointInPolygon(2, 2, lShape)).toBe(true);
    expect(geometry.pointInPolygon(2, 8, lShape)).toBe(true);
    expect(geometry.pointInPolygon(8, 8, lShape)).toBe(false);
    expect(geometry.pointInPolygon(-1, 2, lShape)).toBe(false);
  });
});

describe('clampVolume', () => {
  it('clamps a full-height region to 20..120 and keeps a range inside it', () => {
    expect(geometry.clampVolume(-64, 320)).toEqual({ minY: 20, maxY: 120 });
    expect(geometry.clampVolume(60, 100)).toEqual({ minY: 60, maxY: 100 });
  });

  it('keeps the own range of a region entirely above or below it', () => {
    expect(geometry.clampVolume(150, 200)).toEqual({ minY: 150, maxY: 200 });
    expect(geometry.clampVolume(-60, 10)).toEqual({ minY: -60, maxY: 10 });
  });
});

describe('districtHoles', () => {
  const district = (id: number, world: string, points: Point[]) =>
    ({ key: `district:${id}`, kind: 'district', id, label: `D${id}`, world, outlines: [{ points, minY: 60, maxY: 100 }] });

  it('gives a town a simplified hole for each district inside it on the same world', () => {
    const town = square(0, 0, 100);
    const regions = [
      { key: 'town:1', kind: 'town', id: 1, label: 'T', world: 'world', outlines: [{ points: town, minY: 0, maxY: 0 }] },
      district(4, 'world', [[0, 0], [25, 0], [50, 0], [50, 50], [0, 50]]),
      district(5, 'world', square(50, 50, 50)),
      district(6, 'world', square(950, 950, 50)),
      district(7, 'world_nether', square(10, 10, 20)),
      { key: 'structure:9', kind: 'structure', id: 9, label: 'S', world: 'world', outlines: [{ points: square(1, 1, 5), minY: 0, maxY: 0 }] },
    ];
    expect(geometry.districtHoles(town, 'world', regions)).toEqual([square(0, 0, 50), square(50, 50, 50)]);
  });

  it('gives no holes without districts', () => {
    expect(geometry.districtHoles(square(0, 0, 100), 'world', [])).toEqual([]);
  });
});
