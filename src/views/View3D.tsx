import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { SceneContents } from '../three/SceneContents';

/** Perspektív 3D nézet OrbitControls-szal. */
export function View3D() {
  return (
    <Canvas shadows dpr={[1, 2]} style={{ background: '#1b1d22' }}>
      <PerspectiveCamera makeDefault position={[5.5, 5, 6.5]} fov={50} />
      <OrbitControls makeDefault target={[2, 0.4, 1.5]} maxPolarAngle={Math.PI / 2 + 0.2} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#ffffff', '#444455', 0.5]} />
      <directionalLight position={[5, 8, 3]} intensity={1.1} castShadow />
      <directionalLight position={[-4, 6, -2]} intensity={0.4} />
      <SceneContents mode="3d" />
    </Canvas>
  );
}
