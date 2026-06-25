import { useEffect, useRef, useState } from 'react';
import { PatternKind } from '../model/types';
import { useStore } from '../store/projectStore';
import { allGenerators, getGenerator } from '../patterns/registry';
import { renderSurfaceCanvas, subRegionTiles } from '../render/SurfaceTexture';
import { useImages } from '../render/imageCache';
import { surfaceImageUrls } from '../render/SurfaceTexture';

const MAX_W = 720;
const MAX_H = 520;
const HANDLE_PX = 9; // fogantyú találati sugár képernyő-pixelben
const MIN_CM = 5; // minimális alterület-méret

type Mode = 'region' | 'cells';
type Rect = { u: number; v: number; w: number; h: number };
type HandleKey = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type RegionOp =
  | { kind: 'draw' }
  | { kind: 'move'; subId: string; startRect: Rect; startX: number; startY: number }
  | { kind: 'resize'; subId: string; handle: HandleKey; startRect: Rect }
  | null;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A 8 fogantyú pozíciója egy rect-hez (felület cm). */
function handlePoints(r: Rect): Record<HandleKey, { x: number; y: number }> {
  return {
    nw: { x: r.u, y: r.v },
    n: { x: r.u + r.w / 2, y: r.v },
    ne: { x: r.u + r.w, y: r.v },
    e: { x: r.u + r.w, y: r.v + r.h / 2 },
    se: { x: r.u + r.w, y: r.v + r.h },
    s: { x: r.u + r.w / 2, y: r.v + r.h },
    sw: { x: r.u, y: r.v + r.h },
    w: { x: r.u, y: r.v + r.h / 2 },
  };
}

function hitHandle(p: { x: number; y: number }, r: Rect, radiusCm: number): HandleKey | null {
  const pts = handlePoints(r);
  for (const key of Object.keys(pts) as HandleKey[]) {
    if (Math.abs(p.x - pts[key].x) <= radiusCm && Math.abs(p.y - pts[key].y) <= radiusCm) return key;
  }
  return null;
}

const insideRect = (p: { x: number; y: number }, r: Rect) =>
  p.x >= r.u && p.x <= r.u + r.w && p.y >= r.v && p.y <= r.v + r.h;

/** Átméretezés: a fogantyú által mozgatott él(ek) a kurzorhoz, min. mérettel, felületre vágva. */
function resizeRect(start: Rect, handle: HandleKey, p: { x: number; y: number }, W: number, H: number): Rect {
  let left = start.u;
  let top = start.v;
  let right = start.u + start.w;
  let bottom = start.v + start.h;
  if (handle.includes('w')) left = clamp(p.x, 0, W);
  if (handle.includes('e')) right = clamp(p.x, 0, W);
  if (handle.includes('n')) top = clamp(p.y, 0, H);
  if (handle.includes('s')) bottom = clamp(p.y, 0, H);
  let u = Math.min(left, right);
  let v = Math.min(top, bottom);
  const w = Math.max(MIN_CM, Math.abs(right - left));
  const h = Math.max(MIN_CM, Math.abs(bottom - top));
  if (u + w > W) u = W - w;
  if (v + h > H) v = H - h;
  return { u, v, w, h };
}

/** Oldal-szerkesztő: a felület kiterített 2D nézete, alterületek + minta + cellák. */
export function SurfaceEditor() {
  const editingSurfaceId = useStore((s) => s.editingSurfaceId);
  const surfaces = useStore((s) => s.surfaces)();
  const tileTypes = useStore((s) => s.project.tileTypes);
  const selectedSubRegionId = useStore((s) => s.selectedSubRegionId);
  const selectSubRegion = useStore((s) => s.selectSubRegion);
  const selectedCells = useStore((s) => s.selectedCells);
  const setSelectedCells = useStore((s) => s.setSelectedCells);
  const addSubRegion = useStore((s) => s.addSubRegion);
  const updateSubRegionPattern = useStore((s) => s.updateSubRegionPattern);
  const updateSubRegionRect = useStore((s) => s.updateSubRegionRect);
  const removeSubRegion = useStore((s) => s.removeSubRegion);
  const assignTileToCells = useStore((s) => s.assignTileToCells);
  const beginDrag = useStore((s) => s.beginDrag);
  const endDrag = useStore((s) => s.endDrag);
  const openSurfaceEditor = useStore((s) => s.openSurfaceEditor);

  const surface = surfaces.find((s) => s.id === editingSurfaceId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>('region');
  const drag = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const regionOp = useRef<RegionOp>(null);
  const [, force] = useState(0);
  const [assignTileId, setAssignTileId] = useState<string>('');

  const images = useImages(surface ? surfaceImageUrls(surface, tileTypes) : []);

  const activeSub =
    surface?.subRegions.find((r) => r.id === selectedSubRegionId) ?? surface?.subRegions[0];

  const scale = surface ? Math.min(MAX_W / surface.widthCm, MAX_H / surface.heightCm) : 1;

  // ---- rajzolás ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !surface) return;
    const W = surface.widthCm * scale;
    const H = surface.heightCm * scale;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    // alap textúra
    const { canvas: base } = renderSurfaceCanvas(surface, tileTypes, images);
    ctx.drawImage(base, 0, 0, base.width, base.height, 0, 0, W, H);

    // alterületek
    for (const sub of surface.subRegions) {
      ctx.strokeStyle = sub.id === activeSub?.id ? '#3b82f6' : '#ffffff88';
      ctx.lineWidth = sub.id === activeSub?.id ? 2 : 1;
      ctx.strokeRect(sub.rect.u * scale, sub.rect.v * scale, sub.rect.w * scale, sub.rect.h * scale);
    }

    // átméretező fogantyúk az aktív alterületen (csak alterület módban)
    if (activeSub && mode === 'region') {
      const pts = handlePoints(activeSub.rect);
      const s = HANDLE_PX;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      for (const key of Object.keys(pts) as HandleKey[]) {
        const cx = pts[key].x * scale;
        const cy = pts[key].y * scale;
        ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
        ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      }
    }

    // aktív alterület cellái
    if (activeSub && mode === 'cells') {
      const cells = subRegionTiles(activeSub, tileTypes);
      ctx.save();
      ctx.beginPath();
      ctx.rect(activeSub.rect.u * scale, activeSub.rect.v * scale, activeSub.rect.w * scale, activeSub.rect.h * scale);
      ctx.clip();
      for (const cell of cells) {
        const w = cell.w * scale;
        const h = cell.h * scale;
        ctx.save();
        ctx.translate(cell.cx * scale, cell.cy * scale);
        if (cell.rotationDeg) ctx.rotate((cell.rotationDeg * Math.PI) / 180);
        ctx.strokeStyle = '#00000055';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        if (selectedCells.includes(cell.cellId)) {
          ctx.fillStyle = '#3b82f655';
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // húzott téglalap
    if (drag.current) {
      const { x0, y0, x1, y1 } = drag.current;
      ctx.strokeStyle = '#22c55e';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        Math.min(x0, x1) * scale,
        Math.min(y0, y1) * scale,
        Math.abs(x1 - x0) * scale,
        Math.abs(y1 - y0) * scale,
      );
      ctx.setLineDash([]);
    }
  });

  if (!surface) return null;

  const toSurface = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    return {
      x: Math.max(0, Math.min(surface.widthCm, x)),
      y: Math.max(0, Math.min(surface.heightCm, y)),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = toSurface(e);
    canvasRef.current!.setPointerCapture(e.pointerId);

    if (mode === 'region') {
      const hr = HANDLE_PX / scale;
      // 1) az aktív alterület egyik fogantyúja → átméretezés
      if (activeSub) {
        const handle = hitHandle(p, activeSub.rect, hr);
        if (handle) {
          regionOp.current = { kind: 'resize', subId: activeSub.id, handle, startRect: { ...activeSub.rect } };
          beginDrag();
          force((n) => n + 1);
          return;
        }
      }
      // 2) egy alterület belsejében → kijelölés + mozgatás (előbb az aktív, majd a legfelső)
      const under = [...surface.subRegions].reverse().find((s) => insideRect(p, s.rect));
      const target = activeSub && insideRect(p, activeSub.rect) ? activeSub : under;
      if (target) {
        if (target.id !== activeSub?.id) selectSubRegion(target.id);
        regionOp.current = { kind: 'move', subId: target.id, startRect: { ...target.rect }, startX: p.x, startY: p.y };
        beginDrag();
        force((n) => n + 1);
        return;
      }
      // 3) üres terület → új alterület rajzolása
      regionOp.current = { kind: 'draw' };
    }

    drag.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    force((n) => n + 1);
  };
  const onMove = (e: React.PointerEvent) => {
    const op = regionOp.current;
    const p = toSurface(e);
    if (op?.kind === 'move') {
      const nu = clamp(op.startRect.u + (p.x - op.startX), 0, surface.widthCm - op.startRect.w);
      const nv = clamp(op.startRect.v + (p.y - op.startY), 0, surface.heightCm - op.startRect.h);
      updateSubRegionRect(surface.id, op.subId, { ...op.startRect, u: nu, v: nv });
      return;
    }
    if (op?.kind === 'resize') {
      updateSubRegionRect(surface.id, op.subId, resizeRect(op.startRect, op.handle, p, surface.widthCm, surface.heightCm));
      return;
    }
    if (!drag.current) return;
    drag.current.x1 = p.x;
    drag.current.y1 = p.y;
    force((n) => n + 1);
  };
  const onUp = () => {
    const op = regionOp.current;
    regionOp.current = null;
    if (op && (op.kind === 'move' || op.kind === 'resize')) {
      endDrag();
      force((n) => n + 1);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const x = Math.min(d.x0, d.x1);
    const y = Math.min(d.y0, d.y1);
    const w = Math.abs(d.x1 - d.x0);
    const h = Math.abs(d.y1 - d.y0);

    if (mode === 'region') {
      if (w > 3 && h > 3) {
        const id = addSubRegion(surface.id, { u: x, v: y, w, h });
        selectSubRegion(id);
        setMode('cells');
      }
    } else if (activeSub) {
      const cells = subRegionTiles(activeSub, tileTypes);
      // pont a (forgatott) cellán belül van-e: a pontot a cella lokális keretébe transzformáljuk
      const inside = (c: (typeof cells)[number], px: number, py: number) => {
        const t = (-(c.rotationDeg ?? 0) * Math.PI) / 180;
        const dx = px - c.cx;
        const dy = py - c.cy;
        const lx = dx * Math.cos(t) - dy * Math.sin(t);
        const ly = dx * Math.sin(t) + dy * Math.cos(t);
        return Math.abs(lx) <= c.w / 2 && Math.abs(ly) <= c.h / 2;
      };
      if (w < 2 && h < 2) {
        // klikk: egyetlen cella toggle
        const hit = cells.find((c) => inside(c, x, y));
        if (hit) {
          const id = hit.cellId;
          setSelectedCells(
            selectedCells.includes(id) ? selectedCells.filter((c) => c !== id) : [...selectedCells, id],
          );
        }
      } else {
        // gumikeret: minden cella, melynek a középpontja a keretben van
        const sel = cells
          .filter((c) => c.cx >= x && c.cx <= x + w && c.cy >= y && c.cy <= y + h)
          .map((c) => c.cellId);
        setSelectedCells(sel);
      }
    }
    force((n) => n + 1);
  };

  const gen = activeSub ? getGenerator(activeSub.pattern.generator) : null;

  return (
    <div className="modal-overlay" onClick={() => openSurfaceEditor(null)}>
      <div className="modal surface-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Oldal szerkesztése — {surface.label}</strong>
          <span className="muted">
            {Math.round(surface.widthCm)}×{Math.round(surface.heightCm)} cm
          </span>
          <button className="icon" onClick={() => openSurfaceEditor(null)}>
            ✕
          </button>
        </div>

        <div className="editor-body">
          <div className="editor-side">
            <div className="seg">
              <button className={mode === 'region' ? 'active' : ''} onClick={() => setMode('region')}>
                Alterületek
              </button>
              <button className={mode === 'cells' ? 'active' : ''} onClick={() => setMode('cells')}>
                Cellák kijelölése
              </button>
            </div>
            <p className="muted small">
              {mode === 'region'
                ? 'Üres helyre húzva új alterület. Meglévőt belül húzva mozgathatsz, a sarok/él-fogantyúkkal átméretezhetsz.'
                : 'Kattints/húzz a cellák kijelöléséhez, majd rendelj hozzájuk csempét.'}
            </p>

            <h4>Alterületek</h4>
            <div className="sub-list">
              {surface.subRegions.map((sub, i) => (
                <div key={sub.id} className={'sub-item' + (sub.id === activeSub?.id ? ' active' : '')}>
                  <button className="link" onClick={() => { selectSubRegion(sub.id); setMode('cells'); }}>
                    Alterület #{i + 1} ({getGenerator(sub.pattern.generator).label})
                  </button>
                  <button className="icon danger" onClick={() => removeSubRegion(surface.id, sub.id)}>
                    ✕
                  </button>
                </div>
              ))}
              {surface.subRegions.length === 0 && <p className="muted small">Még nincs alterület.</p>}
            </div>

            {activeSub && (
              <div className="pattern-controls">
                <h4>Minta</h4>
                <label>Típus</label>
                <select
                  value={activeSub.pattern.generator}
                  onChange={(e) => {
                    const generator = e.target.value as PatternKind;
                    const patch: Partial<typeof activeSub.pattern> = { generator, params: {} };
                    // a halszálka tipikusan 45°: ha még nincs forgatás, beállítjuk
                    if (generator === 'herringbone' && (activeSub.pattern.angleDeg ?? 0) === 0) {
                      patch.angleDeg = 45;
                    }
                    updateSubRegionPattern(surface.id, activeSub.id, patch);
                  }}
                >
                  {allGenerators().map((g) => (
                    <option key={g.name} value={g.name}>
                      {g.label}
                    </option>
                  ))}
                </select>

                <label>Alap csempe</label>
                <select
                  value={activeSub.pattern.defaultTileTypeId ?? ''}
                  onChange={(e) =>
                    updateSubRegionPattern(surface.id, activeSub.id, {
                      defaultTileTypeId: e.target.value || null,
                    })
                  }
                >
                  <option value="">— nincs —</option>
                  {tileTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.widthCm}×{t.heightCm})
                    </option>
                  ))}
                </select>

                <label>Elforgatás: {Math.round(activeSub.pattern.angleDeg ?? 0)}°</label>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={activeSub.pattern.angleDeg ?? 0}
                  onChange={(e) =>
                    updateSubRegionPattern(surface.id, activeSub.id, { angleDeg: +e.target.value })
                  }
                />
                <div className="seg" style={{ marginTop: 4 }}>
                  {[0, 30, 45, 90].map((a) => (
                    <button
                      key={a}
                      className={Math.round(activeSub.pattern.angleDeg ?? 0) === a ? 'active' : ''}
                      onClick={() => updateSubRegionPattern(surface.id, activeSub.id, { angleDeg: a })}
                    >
                      {a}°
                    </button>
                  ))}
                </div>

                {gen &&
                  Object.entries(gen.paramSpec).map(([key, spec]) => (
                    <div key={key} className="form-row">
                      <label className="muted">{spec.label}</label>
                      <input
                        type="range"
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        value={activeSub.pattern.params[key] ?? spec.def}
                        onChange={(e) =>
                          updateSubRegionPattern(surface.id, activeSub.id, {
                            params: { ...activeSub.pattern.params, [key]: +e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}

                <div className="form-row">
                  <label className="muted">Eltolás u/v (cm)</label>
                  <input
                    type="number"
                    style={{ width: 56 }}
                    value={Math.round(activeSub.pattern.originOffset.x)}
                    onChange={(e) =>
                      updateSubRegionPattern(surface.id, activeSub.id, {
                        originOffset: { ...activeSub.pattern.originOffset, x: +e.target.value },
                      })
                    }
                  />
                  <input
                    type="number"
                    style={{ width: 56 }}
                    value={Math.round(activeSub.pattern.originOffset.y)}
                    onChange={(e) =>
                      updateSubRegionPattern(surface.id, activeSub.id, {
                        originOffset: { ...activeSub.pattern.originOffset, y: +e.target.value },
                      })
                    }
                  />
                </div>

                <h4>Kijelölt cellák ({selectedCells.length})</h4>
                <select value={assignTileId} onChange={(e) => setAssignTileId(e.target.value)}>
                  <option value="">— válassz csempét —</option>
                  {tileTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  className="primary"
                  disabled={!assignTileId || selectedCells.length === 0}
                  onClick={() => assignTileToCells(surface.id, activeSub.id, selectedCells, assignTileId)}
                >
                  Csempe a kijelöltekhez
                </button>
                <button onClick={() => setSelectedCells([])}>Kijelölés törlése</button>
              </div>
            )}
          </div>

          <div className="editor-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="editor-canvas"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
