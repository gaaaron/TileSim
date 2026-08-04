import { Surface, SubRegion, TileType } from '../model/types';
import { boundingBox } from '../model/geometry';
import { getGenerator } from '../patterns/registry';
import { pickImageUrl } from './tilePicker';

/** Egy alterület befoglaló téglalapja a felület (u,v) terében (cm). */
export function subRegionBBox(sub: SubRegion) {
  const bb = boundingBox(sub.polygon);
  return { u: bb.minX, v: bb.minY, w: bb.w, h: bb.h };
}

/** Egy lerakott csempe a felület (u,v) terében (cm), KÖZÉPPONT + elforgatás alapon. */
export interface CellTile {
  cellId: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotationDeg: number;
  tileTypeId: string | null;
}

function defaultTile(sub: SubRegion, tileTypes: TileType[]): TileType | undefined {
  return tileTypes.find((t) => t.id === sub.pattern.defaultTileTypeId) ?? tileTypes[0];
}

/**
 * Egy alterület csempéi a felület (u,v) terében. A minta `angleDeg` szerint
 * elforgatható a rect közepe körül (pl. halszálka 45°). A renderer és a
 * szerkesztő (kijelölés) is ezt használja.
 */
export function subRegionTiles(sub: SubRegion, tileTypes: TileType[]): CellTile[] {
  const tile = defaultTile(sub, tileTypes);
  const baseW = tile?.widthCm ?? 40;
  const baseH = tile?.heightCm ?? 40;
  // 90°-os csempe-forgatásnál a szélesség/magasság felcserélődik a mintában
  const tw = sub.pattern.tileRotated ? baseH : baseW;
  const th = sub.pattern.tileRotated ? baseW : baseH;
  const gen = getGenerator(sub.pattern.generator);
  const rect = subRegionBBox(sub);
  const theta = ((sub.pattern.angleDeg ?? 0) * Math.PI) / 180;
  const ctx = { tile: { w: tw, h: th }, params: sub.pattern.params, originOffset: sub.pattern.originOffset };
  const tileTypeIdFor = (cellId: string) => sub.tileOverrides[cellId] ?? sub.pattern.defaultTileTypeId ?? null;
  const out: CellTile[] = [];

  // forgatás nélkül: pontos, tengely-igazított elrendezés
  if (Math.abs(theta) < 1e-6) {
    const placements = gen.generate({ w: rect.w, h: rect.h }, ctx);
    for (const p of placements) {
      if (p.x + p.w <= 0 || p.x >= rect.w || p.y + p.h <= 0 || p.y >= rect.h) continue;
      out.push({
        cellId: p.cellId,
        cx: rect.u + p.x + p.w / 2,
        cy: rect.v + p.y + p.h / 2,
        w: p.w,
        h: p.h,
        rotationDeg: 0,
        tileTypeId: tileTypeIdFor(p.cellId),
      });
    }
    return out;
  }

  // forgatott elrendezés: nagyobb területre generálunk, majd a rect közepe körül forgatunk
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const margin = Math.hypot(rect.w, rect.h);
  const pivotX = rect.w / 2;
  const pivotY = rect.h / 2;
  const maxR = Math.max(tw, th);
  const placements = gen.generate({ w: rect.w + 2 * margin, h: rect.h + 2 * margin }, ctx);
  for (const p of placements) {
    const ccx = p.x - margin + p.w / 2; // forgatás előtti középpont rect-koordinátában
    const ccy = p.y - margin + p.h / 2;
    const dx = ccx - pivotX;
    const dy = ccy - pivotY;
    const cx = rect.u + pivotX + (dx * cos - dy * sin);
    const cy = rect.v + pivotY + (dx * sin + dy * cos);
    const lu = cx - rect.u;
    const lv = cy - rect.v;
    if (lu < -maxR || lu > rect.w + maxR || lv < -maxR || lv > rect.h + maxR) continue;
    out.push({
      cellId: p.cellId,
      cx,
      cy,
      w: p.w,
      h: p.h,
      rotationDeg: sub.pattern.angleDeg ?? 0,
      tileTypeId: tileTypeIdFor(p.cellId),
    });
  }
  return out;
}

/** Pixelek/cm a felület méretéből, hogy a canvas ne legyen túl nagy. */
function pixelsPerCm(widthCm: number, heightCm: number, maxPx: number): number {
  const longest = Math.max(widthCm, heightCm, 1);
  return Math.min(6, Math.max(1, maxPx / longest));
}

/** Matt alap érdesség (szürkeárnyalat 0..255). */
const MATTE_GRAY = Math.round(0.9 * 255);
/** Fényesség (0..1) → érdesség szürkeárnyalat (0 = matt → világos; 1 = fényes → sötét). */
function roughGray(gloss: number): number {
  return Math.round(Math.max(0.05, 0.9 - (gloss ?? 0) * 0.85) * 255);
}
const gray = (v: number) => `rgb(${v},${v},${v})`;

/**
 * Egy felület színtextúrája + érdesség-térképe. (u,v) → canvas pixel: u jobbra, v lefelé.
 * A színnél kép híján a csempe `color`-ja; az érdesség-térkép a csempe `glossiness`-éből jön.
 */
export function renderSurfaceCanvas(
  surface: Surface,
  tileTypes: TileType[],
  images: Map<string, HTMLImageElement>,
  maxPx = 2048,
): { canvas: HTMLCanvasElement; roughnessCanvas: HTMLCanvasElement; ppc: number } {
  const ppc = pixelsPerCm(surface.widthCm, surface.heightCm, maxPx);
  const W = Math.max(1, Math.round(surface.widthCm * ppc));
  const H = Math.max(1, Math.round(surface.heightCm * ppc));
  // Függőleges felület (fal / függőleges doboz-oldal): a felület v-tengelye FELFELÉ mutat, a vászon viszont
  // v-lefelé rajzol → a `drawImage` a kép tetejét a padló felé tenné (fejjel lefelé, jól látszik pl. ajtónál).
  // Ezért az ilyen felületeknél a KÉP tartalmát függőlegesen tükrözzük (a régiók pozícióját nem – azt a
  // szerkesztő flipV-je és a 3D leképezés már helyesen kezeli). Vízszintes felület (padló/mennyezet/doboz teteje) nem érintett.
  const flipImg = surface.transform.vAxis.y > 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = W;
  roughnessCanvas.height = H;
  const rctx = roughnessCanvas.getContext('2d')!;

  ctx.fillStyle = surface.baseColor;
  ctx.fillRect(0, 0, W, H);
  rctx.fillStyle = gray(MATTE_GRAY);
  rctx.fillRect(0, 0, W, H);

  const pathPolygon = (c: CanvasRenderingContext2D, poly: { x: number; y: number }[]) => {
    c.beginPath();
    poly.forEach((p, i) => (i === 0 ? c.moveTo(p.x * ppc, p.y * ppc) : c.lineTo(p.x * ppc, p.y * ppc)));
    c.closePath();
  };

  for (const sub of surface.subRegions) {
    const tile = defaultTile(sub, tileTypes);
    const groutCm = (tile?.groutMm ?? 3) / 10;
    const groutColor = tile?.groutColor ?? '#cccccc';

    ctx.save();
    pathPolygon(ctx, sub.polygon);
    ctx.clip();
    ctx.fillStyle = groutColor;
    ctx.fill();

    rctx.save();
    pathPolygon(rctx, sub.polygon);
    rctx.clip();
    rctx.fillStyle = gray(MATTE_GRAY); // fuga matt
    rctx.fill();

    for (const cell of subRegionTiles(sub, tileTypes)) {
      const tt = tileTypes.find((t) => t.id === cell.tileTypeId);
      const dw = (cell.w - groutCm) * ppc;
      const dh = (cell.h - groutCm) * ppc;
      if (dw <= 0 || dh <= 0) continue;

      // szín: kép vagy a csempe sima színe
      const url = pickImageUrl(tt, cell.cellId, sub.imageOverrides?.[cell.cellId]);
      const img = url ? images.get(url) : undefined;
      ctx.save();
      ctx.translate(cell.cx * ppc, cell.cy * ppc);
      if (cell.rotationDeg) ctx.rotate((cell.rotationDeg * Math.PI) / 180);
      if (img) {
        if (flipImg) ctx.scale(1, -1); // fal: a kép álljon (a v-tengely felfelé mutat, a vászon lefelé rajzol)
        if (sub.pattern.tileRotated) {
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -dh / 2, -dw / 2, dh, dw);
        } else {
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        }
      } else {
        ctx.fillStyle = tt?.color ?? (tt ? '#d8cdbb' : '#b9b3a6');
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();

      // érdesség: a csempe fényessége
      rctx.save();
      rctx.translate(cell.cx * ppc, cell.cy * ppc);
      if (cell.rotationDeg) rctx.rotate((cell.rotationDeg * Math.PI) / 180);
      rctx.fillStyle = gray(roughGray(tt?.glossiness ?? 0));
      rctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      rctx.restore();
    }
    ctx.restore();
    rctx.restore();
  }

  return { canvas, roughnessCanvas, ppc };
}

/** Egy felület összes kép-url-je (előtöltéshez). */
export function surfaceImageUrls(surface: Surface, tileTypes: TileType[]): string[] {
  const urls = new Set<string>();
  for (const sub of surface.subRegions) {
    for (const cell of subRegionTiles(sub, tileTypes)) {
      const tt = tileTypes.find((t) => t.id === cell.tileTypeId);
      tt?.images.forEach((i) => i.url && urls.add(i.url));
    }
  }
  return [...urls];
}
