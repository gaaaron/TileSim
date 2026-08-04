import { useMemo, useRef } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CM_TO_WORLD, ModelAsset, SceneObject } from '../model/types';
import { useStore } from '../store/projectStore';

interface Props {
  object: SceneObject;
  model: ModelAsset; // url garantáltan megvan
  mode: 'plan' | '3d';
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Egy elhelyezett GLB objektum; plan nézetben húzható (mint a doboz). */
export function ObjectGroup({ object, model, mode }: Props) {
  const selectObject = useStore((s) => s.selectObject);
  const updateObject = useStore((s) => s.updateObject);
  const beginDrag = useStore((s) => s.beginDrag);
  const endDrag = useStore((s) => s.endDrag);
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const { camera, raycaster, pointer, gl } = useThree();
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const dragging = useRef(false);
  const grabOffset = useRef({ x: 0, z: 0 });
  const selected = selectedObjectId === object.id;

  const { scene: gltfScene } = useGLTF(model.url!);
  const scene = useMemo(() => gltfScene.clone(true), [gltfScene]);
  const { center, min } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const c = new THREE.Vector3();
    box.getCenter(c);
    return { center: c, min: box.min.clone() };
  }, [scene]);

  // skálázás: a natív befoglalót a cél (cm) méretre húzzuk
  const sx = object.size.w / Math.max(1, model.naturalSize.w);
  const sy = object.size.h / Math.max(1, model.naturalSize.h);
  const sz = object.size.d / Math.max(1, model.naturalSize.d);

  const intersectGround = (): THREE.Vector3 | null => {
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'plan') return;
    e.stopPropagation();
    selectObject(object.id);
    const hit = intersectGround();
    if (hit) {
      grabOffset.current = { x: object.pos.x - hit.x / CM_TO_WORLD, z: object.pos.z - hit.z / CM_TO_WORLD };
      dragging.current = true;
      beginDrag();
      if (controls) controls.enabled = false;
      (e.target as Element)?.setPointerCapture?.(e.pointerId);
      gl.domElement.style.cursor = 'grabbing';
    }
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const hit = intersectGround();
    if (hit) {
      updateObject(object.id, {
        pos: { ...object.pos, x: hit.x / CM_TO_WORLD + grabOffset.current.x, z: hit.z / CM_TO_WORLD + grabOffset.current.z },
      });
    }
  };
  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (dragging.current) endDrag();
    dragging.current = false;
    if (controls) controls.enabled = true;
    gl.domElement.style.cursor = 'auto';
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  };

  const world = (cm: number) => cm * CM_TO_WORLD;

  return (
    <group
      position={[world(object.pos.x), world(object.pos.y), world(object.pos.z)]}
      rotation={[0, (object.rotationY * Math.PI) / 180, 0]}
      onPointerDown={mode === 'plan' ? onPointerDown : undefined}
      onPointerMove={mode === 'plan' ? onPointerMove : undefined}
      onPointerUp={mode === 'plan' ? onPointerUp : undefined}
      onClick={mode === '3d' ? (e) => { e.stopPropagation(); selectObject(object.id); } : undefined}
    >
      <group scale={[sx, sy, sz]}>
        <group position={[-center.x, -min.y, -center.z]}>
          <primitive object={scene} />
        </group>
      </group>
      {selected && (
        <mesh position={[0, world(object.size.h / 2), 0]}>
          <boxGeometry args={[world(object.size.w), world(object.size.h), world(object.size.d)]} />
          <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}
