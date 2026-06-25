import { useRef } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, CM_TO_WORLD, Surface, TileType } from '../model/types';
import { useStore } from '../store/projectStore';
import { SurfacePlane } from './SurfacePlane';

interface Props {
  box: Box;
  faces: Surface[]; // a doboz 6 oldala (subRegion adatokkal)
  tileTypes: TileType[];
  mode: 'plan' | '3d';
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Egy doboz a 6 textúrázott oldalával; plan nézetben húzható. */
export function BoxGroup({ box, faces, tileTypes, mode }: Props) {
  const selectBox = useStore((s) => s.selectBox);
  const updateBox = useStore((s) => s.updateBox);
  const beginDrag = useStore((s) => s.beginDrag);
  const endDrag = useStore((s) => s.endDrag);
  const selectedBoxId = useStore((s) => s.selectedBoxId);
  const { camera, raycaster, pointer, gl } = useThree();
  // a kameravezérlő (MapControls/OrbitControls), hogy húzás közben kikapcsolhassuk
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const dragging = useRef(false);
  const grabOffset = useRef({ x: 0, z: 0 });
  const selected = selectedBoxId === box.id;

  const intersectGround = (): THREE.Vector3 | null => {
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'plan') return;
    e.stopPropagation();
    selectBox(box.id);
    const hit = intersectGround();
    if (hit) {
      grabOffset.current = { x: box.pos.x - hit.x / CM_TO_WORLD, z: box.pos.z - hit.z / CM_TO_WORLD };
      dragging.current = true;
      beginDrag(); // egy undo-lépés az egész húzásra
      if (controls) controls.enabled = false; // ne pásztázzon a kamera húzás közben
      (e.target as Element)?.setPointerCapture?.(e.pointerId);
      gl.domElement.style.cursor = 'grabbing';
    }
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const hit = intersectGround();
    if (hit) {
      updateBox(box.id, {
        pos: {
          ...box.pos,
          x: hit.x / CM_TO_WORLD + grabOffset.current.x,
          z: hit.z / CM_TO_WORLD + grabOffset.current.z,
        },
      });
    }
  };
  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (dragging.current) endDrag();
    dragging.current = false;
    if (controls) controls.enabled = true; // kamera újra mozgatható
    gl.domElement.style.cursor = 'auto';
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  };

  return (
    <group
      onPointerDown={mode === 'plan' ? onPointerDown : undefined}
      onPointerMove={mode === 'plan' ? onPointerMove : undefined}
      onPointerUp={mode === 'plan' ? onPointerUp : undefined}
      onClick={mode === '3d' ? (e) => { e.stopPropagation(); selectBox(box.id); } : undefined}
    >
      {faces.map((f) => (
        <SurfacePlane key={f.id} surface={f} tileTypes={tileTypes} interactive={mode === '3d'} />
      ))}
      {selected && <BoxOutline box={box} />}
    </group>
  );
}

function BoxOutline({ box }: { box: Box }) {
  const { w, h, d } = box.size;
  return (
    <mesh
      position={[box.pos.x * CM_TO_WORLD, (box.pos.y + h / 2) * CM_TO_WORLD, box.pos.z * CM_TO_WORLD]}
      rotation={[0, (box.rotationY * Math.PI) / 180, 0]}
    >
      <boxGeometry args={[w * CM_TO_WORLD, h * CM_TO_WORLD, d * CM_TO_WORLD]} />
      <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.6} />
    </mesh>
  );
}
