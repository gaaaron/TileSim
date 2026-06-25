import { describe, expect, it } from 'vitest';
import { gridGenerator } from './grid';
import { herringboneGenerator } from './herringbone';
import { offsetGenerator } from './offset';
import { PatternContext, Size, TilePlacement } from './types';

const ctx = (tile: Size, params: Record<string, number> = {}): PatternContext => ({
  tile,
  params,
  originOffset: { x: 0, y: 0 },
});

/**
 * Mintavételezi a befoglaló belsejét és ellenőrzi, hogy minden pont PONTOSAN
 * egy csempéhez tartozik (nincs hézag, nincs átfedés). A szélektől beljebb
 * mintavételezünk, mert ott a csempék túlnyúlnak / kivágódnak.
 */
function checkCoverage(tiles: TilePlacement[], bounds: Size, inset: number) {
  const step = 2.5;
  let gaps = 0;
  let overlaps = 0;
  for (let x = inset; x < bounds.w - inset; x += step) {
    for (let y = inset; y < bounds.h - inset; y += step) {
      let count = 0;
      for (const t of tiles) {
        if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) count++;
      }
      if (count === 0) gaps++;
      if (count > 1) overlaps++;
    }
  }
  return { gaps, overlaps };
}

describe('grid pattern', () => {
  it('hézag- és átfedésmentes', () => {
    const tiles = gridGenerator.generate({ w: 400, h: 300 }, ctx({ w: 40, h: 60 }));
    const { gaps, overlaps } = checkCoverage(tiles, { w: 400, h: 300 }, 5);
    expect(gaps).toBe(0);
    expect(overlaps).toBe(0);
  });
});

describe('offset pattern', () => {
  it('hézag- és átfedésmentes (fél eltolás)', () => {
    const tiles = offsetGenerator.generate({ w: 400, h: 300 }, ctx({ w: 40, h: 20 }, { offset: 0.5 }));
    const { gaps, overlaps } = checkCoverage(tiles, { w: 400, h: 300 }, 5);
    expect(gaps).toBe(0);
    expect(overlaps).toBe(0);
  });
});

describe('herringbone pattern', () => {
  it('hézag- és átfedésmentes', () => {
    const tiles = herringboneGenerator.generate({ w: 300, h: 300 }, ctx({ w: 40, h: 20 }));
    const { gaps, overlaps } = checkCoverage(tiles, { w: 300, h: 300 }, 50);
    expect(gaps).toBe(0);
    expect(overlaps).toBe(0);
  });
});
