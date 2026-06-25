import { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CM_TO_WORLD, Room, Surface, TileType } from '../model/types';
import { boundingBox, nearestEdge } from '../model/geometry';
import { useStore } from '../store/projectStore';
import { useSurfaceTexture } from './useSurfaceTexture';

interface Props {
  room: Room;
  surface: Surface; // a padló-felület (subRegion adatokkal)
  tileTypes: TileType[];
}

// alaprajzon ezen a távolságon (cm) belül a padlóra duplázva ÚJ csúcspont kerül az élre
const EDGE_INSERT_CM = 25;

/** Tetszőleges alakú padló háromszögelve, a padló-textúrával. */
export function FloorMesh({ room, surface, tileTypes }: Props) {
  const texture = useSurfaceTexture(surface, tileTypes);
  const selectSurface = useStore((s) => s.selectSurface);
  const openSurfaceEditor = useStore((s) => s.openSurfaceEditor);
  const insertRoomVertex = useStore((s) => s.insertRoomVertex);
  const viewMode = useStore((s) => s.viewMode);

  const geometry = useMemo(() => {
    const poly = room.floorPolygon;
    const bb = boundingBox(poly);
    const contour = poly.map((p) => new THREE.Vector2(p.x, p.y));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const positions: number[] = [];
    const uvs: number[] = [];
    for (const p of poly) {
      positions.push(p.x * CM_TO_WORLD, 0, p.y * CM_TO_WORLD);
      uvs.push((p.x - bb.minX) / bb.w, (p.y - bb.minY) / bb.h);
    }
    const index: number[] = [];
    for (const [a, b, c] of tris) index.push(a, b, c);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [room]);

  return (
    <mesh
      geometry={geometry}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectSurface(surface.id);
      }}
      onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        // alaprajzon, ha él közelében duplázunk → új csúcspont; egyébként csempe-szerkesztő
        if (viewMode === 'plan') {
          const p = { x: e.point.x / CM_TO_WORLD, y: e.point.z / CM_TO_WORLD };
          const ne = nearestEdge(room.floorPolygon, p);
          if (ne.distance <= EDGE_INSERT_CM) {
            insertRoomVertex(room.id, ne.index, Math.round(p.x), Math.round(p.y));
            return;
          }
        }
        openSurfaceEditor(surface.id);
      }}
    >
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.9} metalness={0} />
    </mesh>
  );
}
