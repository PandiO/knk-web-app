import { parseCoordinateInput } from './gateCoordinates';

describe('parseCoordinateInput', () => {
  it('parses valid JSON coordinates', () => {
    const result = parseCoordinateInput('{"x":1,"y":2,"z":3}');
    expect(result).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('accepts numeric strings', () => {
    const result = parseCoordinateInput('{"x":"4","y":"5","z":"6"}');
    expect(result).toEqual({ x: 4, y: 5, z: 6 });
  });

  it('returns null for invalid JSON', () => {
    const result = parseCoordinateInput('{invalid');
    expect(result).toBeNull();
  });

  it('returns null when missing coordinates', () => {
    const result = parseCoordinateInput('{"x":1,"y":2}');
    expect(result).toBeNull();
  });
});
