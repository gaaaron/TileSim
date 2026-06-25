import { PatternContext, PatternGenerator, Size, TilePlacement } from './types';

/**
 * Halszálka (90°-os herringbone).
 * A tökéletes összeilleszkedéshez a rövid oldal = hosszú oldal / 2.
 * Motívum: H = (0,0,L,W) vízszintes + V = (L,0,W,L) függőleges csempe.
 * Rács-vektorok: v1 = (W, L+W), v2 = (W, -W) — ezek hézag- és átfedésmentesen
 * töltik a síkot (det = 2·L·W = a motívum területe, L = 2W mellett).
 */
export const herringboneGenerator: PatternGenerator = {
  name: 'herringbone',
  label: 'Halszálka',
  paramSpec: {},
  generate(bounds: Size, ctx: PatternContext): TilePlacement[] {
    const L = Math.max(ctx.tile.w, ctx.tile.h, 1);
    const W = L / 2;
    const v1 = { x: W, y: L + W };
    const v2 = { x: W, y: -W };
    const margin = L;
    const out: TilePlacement[] = [];

    // elég bő egész-tartomány, hogy lefedje a befoglalót; a feleslegeset kivágjuk
    const span = Math.ceil((bounds.w + bounds.h) / W) + 4;
    const intersects = (x: number, y: number, w: number, h: number) =>
      x + w > -margin && x < bounds.w + margin && y + h > -margin && y < bounds.h + margin;

    for (let a = -span; a <= span; a++) {
      for (let b = -span; b <= span; b++) {
        const baseX = a * v1.x + b * v2.x + ctx.originOffset.x;
        const baseY = a * v1.y + b * v2.y + ctx.originOffset.y;
        // H (vízszintes)
        if (intersects(baseX, baseY, L, W)) {
          out.push({ cellId: `${a}_${b}_H`, x: baseX, y: baseY, w: L, h: W, rotationDeg: 0 });
        }
        // V (függőleges)
        if (intersects(baseX + L, baseY, W, L)) {
          out.push({ cellId: `${a}_${b}_V`, x: baseX + L, y: baseY, w: W, h: L, rotationDeg: 0 });
        }
      }
    }
    return out;
  },
};
