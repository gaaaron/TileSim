import { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CM_TO_WORLD, Room, Surface, TileType } from '../model/types';
import { boundingBox, nearestEdge } from '../model/geometry';
import { useStore } from '../store/projectStore';
import { useSurfaceTexture } from './useSurfaceTexture';

interface Props {
  room: Room;
  surface: Surface; // a padló- vagy mennyezet-felület (subRegion adatokkal)
  tileTypes: TileType[];
  /** Ha igaz: a mennyezetet rajzolja (magasságban, lefelé néző, kívülről nem takar). */
  ceiling?: boolean;
}

// alaprajzon ezen a távolságon (cm) belül a padlóra duplázva ÚJ csúcspont kerül az élre
const EDGE_INSERT_CM = 25;

/** Tetszőleges alakú padló/mennyezet háromszögelve, a felület textúrájával. */
export function FloorMesh({ room, surface, tileTypes, ceiling }: Props) {
  const { map, roughnessMap } = useSurfaceTexture(surface, tileTypes);
  const selectSurface = useStore((s) => s.selectSurface);
  const openSurfaceEditor = useStore((s) => s.openSurfaceEditor);
  const insertRoomVertex = useStore((s) => s.insertRoomVertex);
  const viewMode = useStore((s) => s.viewMode);

  const geometry = useMemo(() => {
    const poly = room.floorPolygon;
    const bb = boundingBox(poly);
    const y = ceiling ? room.heightCm * CM_TO_WORLD : 0;
    const contour = poly.map((p) => new THREE.Vector2(p.x, p.y));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const positions: number[] = [];
    const uvs: number[] = [];
    for (const p of poly) {
      positions.push(p.x * CM_TO_WORLD, y, p.y * CM_TO_WORLD);
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
  }, [room, ceiling]);

  return (
    <mesh
      geometry={geometry}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectSurface(surface.id);
      }}
      onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        // padlón, alaprajzon, él közelében duplázva → új csúcspont; egyébként csempe-szerkesztő
        if (!ceiling && viewMode === 'plan') {
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
      {/* a háromszögelés normálja lefelé mutat; a mennyezet FrontSide-ja belülről látszik, kívülről nem takar */}
      <meshStandardMaterial
        map={map}
        roughnessMap={roughnessMap}
        side={ceiling ? THREE.FrontSide : THREE.DoubleSide}
        roughness={1}
        metalness={0}
        // a mennyezet lefelé néz → a directional fény nem éri (a falak igen); egy kis "öntéssel" (fake bounce,
        // a saját textúrájából) pótoljuk a hiányzó megvilágítást, hogy azonos alapszínnél a falhoz hasonlítson
        emissive={ceiling ? '#ffffff' : '#000000'}
        emissiveMap={ceiling ? map : null}
        emissiveIntensity={ceiling ? 0.15 : 0}
      />
    </mesh>
  );
}
