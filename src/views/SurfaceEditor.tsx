import { useEffect, useRef, useState } from 'react';
import { PatternKind } from '../model/types';
import { boundingBox, nearestEdge, pointInPolygon } from '../model/geometry';
import { useStore } from '../store/projectStore';
import { allGenerators, getGenerator } from '../patterns/registry';
import { renderSurfaceCanvas, subRegionTiles, surfaceImageUrls } from '../render/SurfaceTexture';
import { useImages } from '../render/imageCache';

const MAX_W = 720;
const MAX_H = 520;
const HANDLE_PX = 10; // csúcspont-fogantyú mérete/találati sugara képernyő-pixelben

type Mode = 'region' | 'cells';
type Pt = { x: number; y: number };

type RegionOp =
  | { kind: 'draw' }
  | { kind: 'move'; subId: string; startPoly: Pt[]; startX: number; startY: number; started: boolean }
  | { kind: 'vertex'; subId: string; index: number; startX: number; startY: number; started: boolean }
  | null;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function hitVertex(poly: Pt[], p: Pt, rCm: number): number {
  for (let i = 0; i < poly.length; i++) {
    if (Math.abs(p.x - poly[i].x) <= rCm && Math.abs(p.y - poly[i].y) <= rCm) return i;
  }
  return -1;
}

/** A teljes poligon eltolása (dx,dy)-vel úgy, hogy a befoglalója a felületen belül maradjon. */
function translatePoly(poly: Pt[], dx: number, dy: number, W: number, H: number): Pt[] {
  const bb = boundingBox(poly);
  const cdx = clamp(dx, -bb.minX, W - (bb.minX + bb.w));
  const cdy = clamp(dy, -bb.minY, H - (bb.minY + bb.h));
  return poly.map((p) => ({ x: p.x + cdx, y: p.y + cdy }));
}

/** Oldal-szerkesztő: a felület kiterített 2D nézete, alterület-poligonok + minta + cellák. */
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
  const updateSubRegionPolygon = useStore((s) => s.updateSubRegionPolygon);
  const moveSubRegionVertex = useStore((s) => s.moveSubRegionVertex);
  const insertSubRegionVertex = useStore((s) => s.insertSubRegionVertex);
  const deleteSubRegionVertex = useStore((s) => s.deleteSubRegionVertex);
  const removeSubRegion = useStore((s) => s.removeSubRegion);
  const assignTileToCells = useStore((s) => s.assignTileToCells);
  const beginDrag = useStore((s) => s.beginDrag);
  const endDrag = useStore((s) => s.endDrag);
  const toggleSurfaceHidden = useStore((s) => s.toggleSurfaceHidden);
  const openSurfaceEditor = useStore((s) => s.openSurfaceEditor);

  const surface = surfaces.find((s) => s.id === editingSurfaceId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>('region');
  const drag = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const regionOp = useRef<RegionOp>(null);
  const [, force] = useState(0);
  const [assignTileId, setAssignTileId] = useState<string>('');
  const [menu, setMenu] = useState<{ subId: string; index: number; sx: number; sy: number } | null>(null);

  const images = useImages(surface ? surfaceImageUrls(surface, tileTypes) : []);

  const activeSub =
    surface?.subRegions.find((r) => r.id === selectedSubRegionId) ?? surface?.subRegions[0];

  const scale = surface ? Math.min(MAX_W / surface.widthCm, MAX_H / surface.heightCm) : 1;

  const pathPoly = (ctx: CanvasRenderingContext2D, poly: Pt[]) => {
    ctx.beginPath();
    poly.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x * scale, p.y * scale) : ctx.lineTo(p.x * scale, p.y * scale),
    );
    ctx.closePath();
  };

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

    // a felület VALÓDI alakja (pl. L-padló): a körvonalon kívüli rész elsötétítve
    if (surface.outline && surface.outline.length >= 3) {
      ctx.save();
      ctx.fillStyle = 'rgba(18,20,26,0.6)';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      surface.outline.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x * scale, p.y * scale) : ctx.lineTo(p.x * scale, p.y * scale),
      );
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      pathPoly(ctx, surface.outline);
      ctx.stroke();
    }

    // alterület-poligonok
    for (const sub of surface.subRegions) {
      ctx.strokeStyle = sub.id === activeSub?.id ? '#22c55e' : '#ffffff88';
      ctx.lineWidth = sub.id === activeSub?.id ? 2 : 1;
      pathPoly(ctx, sub.polygon);
      ctx.stroke();
    }

    // aktív alterület cellái (cella módban) – a poligonra klippelve
    if (activeSub && mode === 'cells') {
      ctx.save();
      pathPoly(ctx, activeSub.polygon);
      ctx.clip();
      for (const cell of subRegionTiles(activeSub, tileTypes)) {
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

    // aktív alterület csúcspont-fogantyúi (alterület módban)
    if (activeSub && mode === 'region') {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      for (const v of activeSub.polygon) {
        const cx = v.x * scale;
        const cy = v.y * scale;
        ctx.fillRect(cx - HANDLE_PX / 2, cy - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
        ctx.strokeRect(cx - HANDLE_PX / 2, cy - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
      }
    }

    // húzott (új alterület) téglalap
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

  const toXY = (clientX: number, clientY: number): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / scale, 0, surface.widthCm),
      y: clamp((clientY - rect.top) / scale, 0, surface.heightCm),
    };
  };

  const openMenuAt = (subId: string, index: number, v: Pt) => {
    const c = canvasRef.current!;
    setMenu({ subId, index, sx: c.offsetLeft + v.x * scale, sy: c.offsetTop + v.y * scale });
  };

  const onDown = (e: React.PointerEvent) => {
    setMenu(null);
    const p = toXY(e.clientX, e.clientY);
    canvasRef.current!.setPointerCapture(e.pointerId);

    if (mode === 'region') {
      const hr = HANDLE_PX / scale;
      // 1) aktív alterület csúcspontja → csúcs mozgatása (vagy klikk = menü)
      if (activeSub) {
        const vi = hitVertex(activeSub.polygon, p, hr);
        if (vi >= 0) {
          regionOp.current = { kind: 'vertex', subId: activeSub.id, index: vi, startX: p.x, startY: p.y, started: false };
          force((n) => n + 1);
          return;
        }
      }
      // 2) egy alterület belsejében → kijelölés + (mozgatás)
      const under = [...surface.subRegions].reverse().find((s) => pointInPolygon(s.polygon, p));
      const target = activeSub && pointInPolygon(activeSub.polygon, p) ? activeSub : under;
      if (target) {
        if (target.id !== activeSub?.id) selectSubRegion(target.id);
        regionOp.current = {
          kind: 'move',
          subId: target.id,
          startPoly: target.polygon.map((q) => ({ ...q })),
          startX: p.x,
          startY: p.y,
          started: false,
        };
        force((n) => n + 1);
        return;
      }
      // 3) üres terület → új (téglalap) alterület rajzolása
      regionOp.current = { kind: 'draw' };
    }

    drag.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    force((n) => n + 1);
  };

  const onMove = (e: React.PointerEvent) => {
    const op = regionOp.current;
    const p = toXY(e.clientX, e.clientY);
    if (op?.kind === 'vertex') {
      if (!op.started && Math.hypot(p.x - op.startX, p.y - op.startY) > 2) {
        beginDrag();
        op.started = true;
      }
      if (op.started) moveSubRegionVertex(surface.id, op.subId, op.index, Math.round(p.x), Math.round(p.y));
      return;
    }
    if (op?.kind === 'move') {
      const dx = p.x - op.startX;
      const dy = p.y - op.startY;
      if (!op.started && Math.hypot(dx, dy) > 2) {
        beginDrag();
        op.started = true;
      }
      if (op.started) {
        updateSubRegionPolygon(surface.id, op.subId, translatePoly(op.startPoly, dx, dy, surface.widthCm, surface.heightCm));
      }
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
    if (op?.kind === 'vertex') {
      if (op.started) endDrag();
      else {
        const sub = surface.subRegions.find((s) => s.id === op.subId);
        if (sub) openMenuAt(op.subId, op.index, sub.polygon[op.index]);
      }
      force((n) => n + 1);
      return;
    }
    if (op?.kind === 'move') {
      if (op.started) endDrag();
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
        const poly: Pt[] = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ];
        const id = addSubRegion(surface.id, poly);
        selectSubRegion(id);
      }
    } else if (activeSub) {
      const cells = subRegionTiles(activeSub, tileTypes);
      const inCell = (c: (typeof cells)[number], px: number, py: number) => {
        const t = (-(c.rotationDeg ?? 0) * Math.PI) / 180;
        const dx = px - c.cx;
        const dy = py - c.cy;
        const lx = dx * Math.cos(t) - dy * Math.sin(t);
        const ly = dx * Math.sin(t) + dy * Math.cos(t);
        return Math.abs(lx) <= c.w / 2 && Math.abs(ly) <= c.h / 2;
      };
      if (w < 2 && h < 2) {
        // klikk: egyetlen cella toggle – csak a poligonon belül
        if (pointInPolygon(activeSub.polygon, { x, y })) {
          const hit = cells.find((c) => inCell(c, x, y));
          if (hit) {
            const id = hit.cellId;
            setSelectedCells(
              selectedCells.includes(id) ? selectedCells.filter((c) => c !== id) : [...selectedCells, id],
            );
          }
        }
      } else {
        // gumikeret: a keretbe ÉS a poligonba eső középpontú cellák
        const sel = cells
          .filter(
            (c) =>
              c.cx >= x && c.cx <= x + w && c.cy >= y && c.cy <= y + h && pointInPolygon(activeSub.polygon, { x: c.cx, y: c.cy }),
          )
          .map((c) => c.cellId);
        setSelectedCells(sel);
      }
    }
    force((n) => n + 1);
  };

  const onDouble = (e: React.MouseEvent) => {
    if (mode !== 'region' || !activeSub) return;
    const p = toXY(e.clientX, e.clientY);
    const ne = nearestEdge(activeSub.polygon, p);
    if (ne.distance <= 14 / scale) {
      insertSubRegionVertex(surface.id, activeSub.id, ne.index, Math.round(p.x), Math.round(p.y));
    }
  };

  const gen = activeSub ? getGenerator(activeSub.pattern.generator) : null;
  const menuSub = menu ? surface.subRegions.find((s) => s.id === menu.subId) : null;

  return (
    <div className="modal-overlay" onClick={() => openSurfaceEditor(null)}>
      <div className="modal surface-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Oldal szerkesztése — {surface.label}</strong>
          <span className="muted">
            {Math.round(surface.widthCm)}×{Math.round(surface.heightCm)} cm
          </span>
          <label className="vis-toggle" title="A fal megjelenítése a 3D nézetben">
            <input type="checkbox" checked={!surface.hidden} onChange={() => toggleSurfaceHidden(surface.id)} />
            Látható
          </label>
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
                ? 'Üres helyre húzva új alterület. Csúcspontot húzva mozgatsz, belül húzva az egészet mozgatod. Dupla katt egy élre = új pont; csúcspontra kattintva törölhető.'
                : 'Kattints/húzz a cellák kijelöléséhez, majd rendelj hozzájuk csempét.'}
            </p>

            <h4>Alterületek</h4>
            <div className="sub-list">
              {surface.subRegions.map((sub, i) => (
                <div key={sub.id} className={'sub-item' + (sub.id === activeSub?.id ? ' active' : '')}>
                  <button className="link" onClick={() => selectSubRegion(sub.id)}>
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
                    updateSubRegionPattern(surface.id, activeSub.id, { defaultTileTypeId: e.target.value || null })
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
                  onChange={(e) => updateSubRegionPattern(surface.id, activeSub.id, { angleDeg: +e.target.value })}
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
              onDoubleClick={onDouble}
            />
            {menu && (
              <div
                className="vertex-menu editor-menu"
                style={{ left: menu.sx, top: menu.sy }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  disabled={(menuSub?.polygon.length ?? 0) <= 3}
                  onClick={() => {
                    deleteSubRegionVertex(surface.id, menu.subId, menu.index);
                    setMenu(null);
                  }}
                >
                  Pont törlése
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
