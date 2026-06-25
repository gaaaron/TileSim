import { PatternContext, PatternGenerator, Size, TilePlacement } from './types';

/** Kötésben eltolt (brick bond): minden sor el van tolva az előzőhöz képest. */
export const offsetGenerator: PatternGenerator = {
  name: 'offset',
  label: 'Kötésben eltolt',
  paramSpec: {
    offset: { label: 'Eltolás (csempe arány)', def: 0.5, min: 0, max: 1, step: 0.05 },
  },
  generate(bounds: Size, ctx: PatternContext): TilePlacement[] {
    const tw = Math.max(ctx.tile.w, 1);
    const th = Math.max(ctx.tile.h, 1);
    const frac = ctx.params.offset ?? 0.5;
    const oy = ((ctx.originOffset.y % th) + th) % th;
    const out: TilePlacement[] = [];
    let row = 0;
    for (let y = oy - th; y < bounds.h + th; y += th, row++) {
      const shift = ((row * frac * tw) % tw);
      const ox = (((ctx.originOffset.x - shift) % tw) + tw) % tw;
      let col = 0;
      for (let x = ox - tw; x < bounds.w + tw; x += tw, col++) {
        out.push({ cellId: `${col}_${row}`, x, y, w: tw, h: th, rotationDeg: 0 });
      }
    }
    return out;
  },
};
