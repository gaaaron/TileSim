import {
  Box,
  CM_TO_WORLD,
  Room,
  Surface,
  SurfaceTransform,
  Vec2,
  Vec3,
} from './types';

// --- kis vektor-segédek (cm-ben dolgozunk, kivéve ahol world jelölve) ---
const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);

/** Y tengely körüli forgatás (three.js konvenció), szög radiánban. */
function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return v3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}

/** Poligon előjeles területe az XZ síkon (x, y=z). */
export function signedArea(poly: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

export function boundingBox(poly: Vec2[]) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** A padló felülete egy szobához. UV = a befoglaló téglalap (cm). */
export function floorSurface(room: Room): Surface {
  const bb = boundingBox(room.floorPolygon);
  const transform: SurfaceTransform = {
    origin: scale(v3(bb.minX, 0, bb.minY), CM_TO_WORLD),
    uAxis: v3(1, 0, 0),
    vAxis: v3(0, 0, 1),
    normal: v3(0, 1, 0),
  };
  return {
    id: `${room.id}:floor`,
    kind: 'floor',
    label: `${room.name} – padló`,
    widthCm: bb.w,
    heightCm: bb.h,
    transform,
    subRegions: [],
    baseColor: '#cfcabb',
  };
}

/** A szoba falai (minden poligon-élhez egy fal). u = él menti hossz, v = magasság. */
export function wallSurfaces(room: Room): Surface[] {
  const poly = room.floorPolygon;
  const centroid = polygonCentroid(poly);
  const surfaces: Surface[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) continue;
    const dir = { x: dx / len, z: dz / len };
    // két lehetséges merőleges; a befelé (centroid felé) mutatót választjuk
    const midX = (a.x + b.x) / 2;
    const midZ = (a.y + b.y) / 2;
    let nx = -dir.z;
    let nz = dir.x;
    const toC = { x: centroid.x - midX, z: centroid.y - midZ };
    if (nx * toC.x + nz * toC.z < 0) {
      nx = -nx;
      nz = -nz;
    }
    const transform: SurfaceTransform = {
      origin: scale(v3(a.x, 0, a.y), CM_TO_WORLD),
      uAxis: v3(dir.x, 0, dir.z),
      vAxis: v3(0, 1, 0),
      normal: v3(nx, 0, nz),
    };
    surfaces.push({
      id: `${room.id}:wall:${i}`,
      kind: 'wall',
      label: `${room.name} – fal #${i + 1}`,
      widthCm: len,
      heightCm: room.heightCm,
      transform,
      subRegions: [],
      baseColor: '#e7e3da',
    });
  }
  return surfaces;
}

interface FaceDef {
  key: string;
  label: string;
  normal: Vec3;
  uDir: Vec3;
  vDir: Vec3;
  uSize: number; // cm
  vSize: number; // cm
}

/** Egy doboz 6 oldala felületként, a rotationY figyelembevételével. */
export function boxFaceSurfaces(box: Box): Surface[] {
  const { w, h, d } = box.size;
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  // a doboz középpontja cm-ben (pos.y = az alja)
  const center = v3(box.pos.x, box.pos.y + hy, box.pos.z);
  const a = (box.rotationY * Math.PI) / 180;

  const faces: FaceDef[] = [
    { key: 'front', label: 'eleje (+Z)', normal: v3(0, 0, 1), uDir: v3(1, 0, 0), vDir: v3(0, 1, 0), uSize: w, vSize: h },
    { key: 'back', label: 'hátulja (-Z)', normal: v3(0, 0, -1), uDir: v3(-1, 0, 0), vDir: v3(0, 1, 0), uSize: w, vSize: h },
    { key: 'right', label: 'jobb (+X)', normal: v3(1, 0, 0), uDir: v3(0, 0, -1), vDir: v3(0, 1, 0), uSize: d, vSize: h },
    { key: 'left', label: 'bal (-X)', normal: v3(-1, 0, 0), uDir: v3(0, 0, 1), vDir: v3(0, 1, 0), uSize: d, vSize: h },
    { key: 'top', label: 'teteje (+Y)', normal: v3(0, 1, 0), uDir: v3(1, 0, 0), vDir: v3(0, 0, 1), uSize: w, vSize: d },
    { key: 'bottom', label: 'alja (-Y)', normal: v3(0, -1, 0), uDir: v3(1, 0, 0), vDir: v3(0, 0, -1), uSize: w, vSize: d },
  ];

  return faces.map((f) => {
    // a felület középpontja: a középponttól a normál irányba a fél-vastagsággal
    const halfAlong = f.key === 'front' || f.key === 'back' ? hz : f.key === 'right' || f.key === 'left' ? hx : hy;
    const faceCenterLocal = scale(f.normal, halfAlong);
    // a (u=0,v=0) sarok local koordinátája
    const cornerLocal = add(
      faceCenterLocal,
      add(scale(f.uDir, -f.uSize / 2), scale(f.vDir, -f.vSize / 2)),
    );
    const originCm = add(center, rotateY(cornerLocal, a));
    const transform: SurfaceTransform = {
      origin: scale(originCm, CM_TO_WORLD),
      uAxis: rotateY(f.uDir, a),
      vAxis: rotateY(f.vDir, a),
      normal: rotateY(f.normal, a),
    };
    return {
      id: `${box.id}:face:${f.key}`,
      kind: 'box-face' as const,
      label: `${box.name} – ${f.label}`,
      widthCm: f.uSize,
      heightCm: f.vSize,
      transform,
      subRegions: [],
      baseColor: '#bfc6cc',
    };
  });
}

/** Egy projekt összes felülete (felület-geometria, subRegion adat nélkül). */
export function allSurfaces(rooms: Room[], boxes: Box[]): Surface[] {
  const out: Surface[] = [];
  for (const r of rooms) {
    out.push(floorSurface(r));
    out.push(...wallSurfaces(r));
  }
  for (const b of boxes) {
    out.push(...boxFaceSurfaces(b));
  }
  return out;
}

/** Egy (u,v) felület-pont világ-koordinátája (méter). */
export function surfaceToWorld(t: SurfaceTransform, u: number, v: number): Vec3 {
  return add(
    t.origin,
    add(scale(t.uAxis, u * CM_TO_WORLD), scale(t.vAxis, v * CM_TO_WORLD)),
  );
}
