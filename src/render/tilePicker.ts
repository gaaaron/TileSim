import { TileType } from '../model/types';

/** Stabil hash egy cella-id-ből, hogy a vegyes kép-kiosztás determinisztikus legyen. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/**
 * Egy cellához kiválaszt egy képet a csempetípus képei közül.
 * Több kép esetén a cellId hash alapján kever (determinisztikus „vegyes lerakás").
 */
export function pickImageUrl(tile: TileType | undefined, cellId: string): string | null {
  if (!tile || tile.images.length === 0) return null;
  const idx = hash(cellId) % tile.images.length;
  return tile.images[idx].url ?? null;
}
