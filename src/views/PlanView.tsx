import { Canvas } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import { SceneContents } from '../three/SceneContents';
import { RoomEditingLayer } from '../three/RoomEditingLayer';

/** Alaprajz (felülnézet): ortografikus, fentről lefelé. Rajzolás + doboz-mozgatás. */
export function PlanView() {
  return (
    <Canvas style={{ background: '#23262d' }}>
      <OrthographicCamera makeDefault position={[2, 50, 2]} up={[0, 0, -1]} zoom={120} near={0.1} far={500} />
      <MapControls makeDefault enableRotate={false} screenSpacePanning={false} target={[2, 0, 2]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 10, 4]} intensity={0.6} />

      <SceneContents mode="plan" />
      <RoomEditingLayer />
    </Canvas>
  );
}
