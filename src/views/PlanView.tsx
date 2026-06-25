import { Canvas, ThreeEvent } from '@react-three/fiber';
import { Line, MapControls, OrthographicCamera } from '@react-three/drei';
import { CM_TO_WORLD } from '../model/types';
import { useStore } from '../store/projectStore';
import { SceneContents } from '../three/SceneContents';

/** Alaprajz (felülnézet): ortografikus, fentről lefelé. Rajzolás + doboz-mozgatás. */
export function PlanView() {
  const planTool = useStore((s) => s.planTool);
  const draftRoom = useStore((s) => s.draftRoom);
  const addDraftPoint = useStore((s) => s.addDraftPoint);

  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (planTool !== 'draw-room') return;
    e.stopPropagation();
    addDraftPoint(Math.round(e.point.x / CM_TO_WORLD), Math.round(e.point.z / CM_TO_WORLD));
  };

  const draftPoints: [number, number, number][] =
    draftRoom?.map((p) => [p.x * CM_TO_WORLD, 0.03, p.y * CM_TO_WORLD]) ?? [];

  return (
    <Canvas style={{ background: '#23262d' }}>
      <OrthographicCamera makeDefault position={[2, 50, 2]} up={[0, 0, -1]} zoom={120} near={0.1} far={500} />
      <MapControls makeDefault enableRotate={false} screenSpacePanning={false} target={[2, 0, 2]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 10, 4]} intensity={0.6} />

      <SceneContents mode="plan" />

      {/* rajzoló sík (csak rajzolás módban fog el kattintást) */}
      {planTool === 'draw-room' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onClick={onGroundClick}>
          <planeGeometry args={[2000, 2000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* vázlat-poligon */}
      {draftPoints.length > 0 && (
        <>
          <Line points={draftPoints.length >= 2 ? draftPoints : [...draftPoints, draftPoints[0]]} color="#3b82f6" lineWidth={2} />
          {draftPoints.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.03, 12, 12]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
          ))}
        </>
      )}
    </Canvas>
  );
}
