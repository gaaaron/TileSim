import { TileType } from '../model/types';

/** Stabil hash egy cella-id-ből, hogy a vegyes kép-kiosztás determinisztikus legyen. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A cellához tartozó kép INDEXE a csempe images tömbjében.
 * `override` (per-cella kép-index) elsőbbséget élvez; egyébként a cellId hash determinisztikusan kever.
 * -1, ha nincs kép.
 */
export function imageIndexFor(tile: TileType | undefined, cellId: string, override?: number): number {
  if (!tile || tile.images.length === 0) return -1;
  const n = tile.images.length;
  if (override != null) return ((Math.round(override) % n) + n) % n;
  return hash(cellId) % n;
}

/** A cellához kiválasztott kép URL-je (vagy null). `override` = kézi per-cella kép-index. */
export function pickImageUrl(tile: TileType | undefined, cellId: string, override?: number): string | null {
  const idx = imageIndexFor(tile, cellId, override);
  return idx < 0 ? null : tile!.images[idx].url ?? null;
}
