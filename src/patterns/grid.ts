import { PatternContext, PatternGenerator, Size, TilePlacement } from './types';

/** Szimmetrikus rács: azonos méretű csempék sorokban/oszlopokban. */
export const gridGenerator: PatternGenerator = {
  name: 'grid',
  label: 'Szimmetrikus rács',
  paramSpec: {},
  generate(bounds: Size, ctx: PatternContext): TilePlacement[] {
    const tw = Math.max(ctx.tile.w, 1);
    const th = Math.max(ctx.tile.h, 1);
    const ox = ((ctx.originOffset.x % tw) + tw) % tw;
    const oy = ((ctx.originOffset.y % th) + th) % th;
    const out: TilePlacement[] = [];
    let row = 0;
    for (let y = oy - th; y < bounds.h + th; y += th, row++) {
      let col = 0;
      for (let x = ox - tw; x < bounds.w + tw; x += tw, col++) {
        out.push({ cellId: `${col}_${row}`, x, y, w: tw, h: th, rotationDeg: 0 });
      }
    }
    return out;
  },
};
