export type GateCoordinate = {
  x: number;
  y: number;
  z: number;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

export const parseCoordinateInput = (value?: string | null): GateCoordinate | null => {
  if (!value || value.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const x = toNumber(parsed?.x);
    const y = toNumber(parsed?.y);
    const z = toNumber(parsed?.z);

    if (x === null || y === null || z === null) {
      return null;
    }

    return { x, y, z };
  } catch (error) {
    return null;
  }
};
