import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { SceneContents } from '../three/SceneContents';

/** Perspektív 3D nézet OrbitControls-szal. */
export function View3D() {
  return (
    <Canvas shadows dpr={[1, 2]} style={{ background: '#1b1d22' }}>
      <PerspectiveCamera makeDefault position={[5.5, 5, 6.5]} fov={50} />
      <OrbitControls makeDefault target={[2, 0.4, 1.5]} maxPolarAngle={Math.PI / 2 + 0.2} />
      <ambientLight intensity={0.55} />
      {/* a talaj-szín ne legyen túl sötét: a lefelé néző mennyezet a teljes talaj-színt kapja */}
      <hemisphereLight args={['#ffffff', '#6d6d78', 0.4]} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} castShadow />
      <directionalLight position={[-4, 6, -2]} intensity={0.4} />

      {/* Procedurális környezet (offline): a fényes csempék ezeket tükrözik → látható fényesség */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[3, 6, 4]} scale={[8, 8, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1} position={[-5, 4, -3]} scale={[6, 6, 1]} color="#aab4cc" />
        <Lightformer form="rect" intensity={0.6} position={[0, 3, -6]} scale={[10, 4, 1]} color="#ffe9c8" />
      </Environment>

      <SceneContents mode="3d" />
    </Canvas>
  );
}
