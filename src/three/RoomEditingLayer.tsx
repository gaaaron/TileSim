import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { CM_TO_WORLD, Vec2 } from '../model/types';
import { useStore } from '../store/projectStore';

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const CLOSE_CM = 20; // ennyin belül a kezdőpontra kattintva záródik a poligon
const MOVE_PX = 4; // ennyi pixel mozgás felett számít húzásnak (nem kattintásnak)

const w = (p: Vec2): [number, number, number] => [p.x * CM_TO_WORLD, 0.05, p.y * CM_TO_WORLD];
const lenCm = (a: Vec2, b: Vec2) => Math.round(Math.hypot(b.x - a.x, b.y - a.y));

/** A pontot a `prev`-hez képest 45°-os szögrácsra igazítja (Shift „kiegyenesítés"). */
function snapAngle(prev: Vec2, q: Vec2): Vec2 {
  const dx = q.x - prev.x;
  const dy = q.y - prev.y;
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: prev.x + Math.cos(a) * len, y: prev.y + Math.sin(a) * len };
}

type Drag =
  | { kind: 'draft'; index: number }
  | { kind: 'vertex'; roomId: string; index: number; startX: number; startY: number; moved: boolean }
  | null;

/** Alaprajzi szoba-rajzolás és csúcspont-szerkesztés (R3F, plan nézet). */
export function RoomEditingLayer() {
  const planTool = useStore((s) => s.planTool);
  const rooms = useStore((s) => s.project.rooms);
  const draftRoom = useStore((s) => s.draftRoom);
  const roomHidden = useStore((s) => s.project.roomHidden);
  const deleteRoomVertex = useStore((s) => s.deleteRoomVertex);

  const { camera, gl, raycaster, controls } = useThree((s) => ({
    camera: s.camera,
    gl: s.gl,
    raycaster: s.raycaster,
    controls: s.controls,
  })) as { camera: THREE.Camera; gl: THREE.WebGLRenderer; raycaster: THREE.Raycaster; controls: { enabled: boolean } | null };
  const env = useRef({ camera, gl, raycaster, controls });
  env.current = { camera, gl, raycaster, controls };

  const [menu, setMenu] = useState<{ roomId: string; index: number } | null>(null);
  const dragRef = useRef<Drag>(null);
  const shiftRef = useRef(false);
  const lastClient = useRef({ x: 0, y: 0 });

  const screenToCm = (clientX: number, clientY: number): Vec2 | null => {
    const { camera, gl, raycaster } = env.current;
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(GROUND, hit)) return null;
    return { x: hit.x / CM_TO_WORLD, y: hit.z / CM_TO_WORLD };
  };

  // a húzás magját ref-ben tartjuk, hogy a window-listenerek és a Shift-billentyű is hívhassák
  const core = useRef((cx: number, cy: number) => {
    const d = dragRef.current;
    if (!d) return;
    let p = screenToCm(cx, cy);
    if (!p) return;
    const st = useStore.getState();
    if (d.kind === 'draft') {
      const prev = st.draftRoom?.[d.index - 1];
      if (shiftRef.current && prev) p = snapAngle(prev, p);
      st.updateDraftPoint(d.index, Math.round(p.x), Math.round(p.y));
    } else if (d.kind === 'vertex') {
      if (Math.hypot(cx - d.startX, cy - d.startY) > MOVE_PX) d.moved = true;
      st.moveRoomVertex(d.roomId, d.index, Math.round(p.x), Math.round(p.y));
    }
  });

  const onWinMove = useCallback((e: PointerEvent) => {
    lastClient.current = { x: e.clientX, y: e.clientY };
    core.current(e.clientX, e.clientY);
  }, []);
  const onWinUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
    if (env.current.controls) env.current.controls.enabled = true;
    if (!d) return;
    if (d.kind === 'vertex') {
      useStore.getState().endDrag();
      if (!d.moved) setMenu({ roomId: d.roomId, index: d.index });
    }
  }, [onWinMove]);

  const startDrag = (d: Drag, shift: boolean) => {
    dragRef.current = d;
    shiftRef.current = shift;
    if (env.current.controls) env.current.controls.enabled = false;
    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
  };

  // Shift „kiegyenesítés" élő frissítése húzás közben
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftRef.current = true;
        if (dragRef.current) core.current(lastClient.current.x, lastClient.current.y);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftRef.current = false;
        if (dragRef.current) core.current(lastClient.current.x, lastClient.current.y);
      }
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  // a context menu bezárása bármilyen máshova kattintásra
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  // --- rajzolás módban: a földsík fogja a lenyomást (új pont + élő húzás) ---
  const onGroundDown = (e: ThreeEvent<PointerEvent>) => {
    if (planTool !== 'draw-room') return;
    e.stopPropagation();
    setMenu(null);
    const st = useStore.getState();
    const d = st.draftRoom ?? [];
    const p = { x: Math.round(e.point.x / CM_TO_WORLD), y: Math.round(e.point.z / CM_TO_WORLD) };
    if (d.length >= 3 && Math.hypot(p.x - d[0].x, p.y - d[0].y) < CLOSE_CM) {
      st.commitDraftRoom();
      return;
    }
    const idx = d.length;
    st.addDraftPoint(p.x, p.y);
    startDrag({ kind: 'draft', index: idx }, e.nativeEvent.shiftKey);
  };

  const onVertexDown = (roomId: string, index: number) => (e: ThreeEvent<PointerEvent>) => {
    if (planTool === 'draw-room') return;
    e.stopPropagation();
    setMenu(null);
    useStore.getState().beginDrag();
    startDrag(
      { kind: 'vertex', roomId, index, startX: e.nativeEvent.clientX, startY: e.nativeEvent.clientY, moved: false },
      e.nativeEvent.shiftKey,
    );
  };

  const drawing = planTool === 'draw-room';
  const draft = draftRoom ?? [];

  return (
    <group>
      {/* rajzoló földsík (csak rajzolás módban) */}
      {drawing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onPointerDown={onGroundDown}>
          <planeGeometry args={[4000, 4000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* vázlat (rajzolás közben) */}
      {drawing && draft.length > 0 && (
        <group>
          {draft.length >= 2 && <Line points={draft.map(w)} color="#3b82f6" lineWidth={2} />}
          {draft.map((p, i) => (
            <mesh key={i} position={w(p)}>
              <sphereGeometry args={[0.045, 14, 14]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
          ))}
          {draft.slice(1).map((p, i) => {
            const a = draft[i];
            const mid: [number, number, number] = [
              ((a.x + p.x) / 2) * CM_TO_WORLD,
              0.12,
              ((a.y + p.y) / 2) * CM_TO_WORLD,
            ];
            return (
              <Html key={'l' + i} position={mid} center style={{ pointerEvents: 'none' }}>
                <div className="wall-len">{lenCm(a, p)} cm</div>
              </Html>
            );
          })}
        </group>
      )}

      {/* meglévő szobák: kontúr + hosszcímkék + mozgatható csúcspont-fogantyúk.
          (Él-kettősklikk = új pont a FloorMesh-ben kezelve, megbízható nagy találati felület.) */}
      {!drawing &&
        rooms.map((room) => {
          if (roomHidden[room.id]) return null;
          const poly = room.floorPolygon;
          return (
            <group key={room.id}>
              <Line points={[...poly.map(w), w(poly[0])]} color="#3b82f6" lineWidth={1.5} transparent opacity={0.7} />
              {poly.map((a, i) => {
                const b = poly[(i + 1) % poly.length];
                const mid: [number, number, number] = [
                  ((a.x + b.x) / 2) * CM_TO_WORLD,
                  0.12,
                  ((a.y + b.y) / 2) * CM_TO_WORLD,
                ];
                return (
                  <Html key={'l' + i} position={mid} center style={{ pointerEvents: 'none' }}>
                    <div className="wall-len">{lenCm(a, b)} cm</div>
                  </Html>
                );
              })}
              {poly.map((p, i) => (
                <mesh key={'v' + i} position={[p.x * CM_TO_WORLD, 0.06, p.y * CM_TO_WORLD]} onPointerDown={onVertexDown(room.id, i)}>
                  <sphereGeometry args={[0.05, 16, 16]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              ))}
            </group>
          );
        })}

      {/* csúcspont context menu */}
      {menu &&
        (() => {
          const room = rooms.find((r) => r.id === menu.roomId);
          const v = room?.floorPolygon[menu.index];
          if (!v) return null;
          const canDelete = (room?.floorPolygon.length ?? 0) > 3;
          return (
            <Html position={[v.x * CM_TO_WORLD, 0.2, v.y * CM_TO_WORLD]} center>
              <div className="vertex-menu" onPointerDown={(e) => e.stopPropagation()}>
                <button
                  disabled={!canDelete}
                  onClick={() => {
                    deleteRoomVertex(menu.roomId, menu.index);
                    setMenu(null);
                  }}
                >
                  Pont törlése
                </button>
              </div>
            </Html>
          );
        })()}
    </group>
  );
}
