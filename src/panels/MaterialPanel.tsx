import { useMemo } from 'react';
import { Project } from '../model/types';
import { allSurfaces, pointInPolygon } from '../model/geometry';
import { subRegionTiles } from '../render/SurfaceTexture';
import { useStore } from '../store/projectStore';

interface MaterialRow {
  tileId: string;
  name: string;
  pieces: number;
  areaM2: number;
}

/**
 * Csempénként összesíti a szükséges darabszámot és m²-t.
 * Egy cella = 1 db (a vágott darabok is egynek számítanak): azokat a cellákat számoljuk,
 * amelyek KÖZÉPPONTJA az alterület poligonján belül van. m² = darab × csempeterület.
 * SZÁMÍTÁSIGÉNYES (minden alterület minden celláját legenerálja) → csak nyitott panelnél fut.
 */
function computeMaterials(project: Project): MaterialRow[] {
  const base = allSurfaces(project.rooms, project.boxes);
  const pieces = new Map<string, number>();
  for (const surface of base) {
    const subs = project.surfaceData[surface.id] ?? [];
    for (const sub of subs) {
      for (const cell of subRegionTiles(sub, project.tileTypes)) {
        if (!cell.tileTypeId) continue;
        if (!pointInPolygon(sub.polygon, { x: cell.cx, y: cell.cy })) continue;
        pieces.set(cell.tileTypeId, (pieces.get(cell.tileTypeId) ?? 0) + 1);
      }
    }
  }
  return project.tileTypes
    .map((t) => {
      const n = pieces.get(t.id) ?? 0;
      return { tileId: t.id, name: t.name, pieces: n, areaM2: (n * t.widthCm * t.heightCm) / 10000 };
    })
    .filter((r) => r.pieces > 0);
}

/** Anyagszükséglet: csempénként db + m². (Csak akkor renderel/számol, ha a csoport nyitva van.) */
export function MaterialPanel() {
  const project = useStore((s) => s.project);
  const rows = useMemo(() => computeMaterials(project), [project]);

  if (rows.length === 0) {
    return <p className="muted small">Nincs csempézett terület.</p>;
  }

  const totalPieces = rows.reduce((a, r) => a + r.pieces, 0);
  const totalArea = rows.reduce((a, r) => a + r.areaM2, 0);

  return (
    <div className="material-list">
      <div className="material-row material-head">
        <span className="link">Csempe</span>
        <span className="muted small">db</span>
        <span className="muted small">m²</span>
      </div>
      {rows.map((r) => (
        <div key={r.tileId} className="material-row">
          <span className="link">{r.name}</span>
          <span>{r.pieces}</span>
          <span>{r.areaM2.toFixed(2)}</span>
        </div>
      ))}
      <div className="material-row material-total">
        <span className="link">Összesen</span>
        <span>{totalPieces}</span>
        <span>{totalArea.toFixed(2)}</span>
      </div>
      <p className="muted small">A vágott darabok is 1 db-nak számítanak (becslés).</p>
    </div>
  );
}
