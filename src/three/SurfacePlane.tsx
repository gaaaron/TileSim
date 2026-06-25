import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Surface, TileType } from '../model/types';
import { useStore } from '../store/projectStore';
import { surfacePose } from './pose';
import { useSurfaceTexture } from './useSurfaceTexture';

interface Props {
  surface: Surface;
  tileTypes: TileType[];
  /** Ha false, a felület nem reagál kattintásra (a szülő csoport kezeli – pl. plan nézetben). */
  interactive?: boolean;
}

/** Planáris csempézhető felület (fal vagy doboz-oldal). */
export function SurfacePlane({ surface, tileTypes, interactive = true }: Props) {
  const texture = useSurfaceTexture(surface, tileTypes);
  const { position, quaternion, width, height, frontFacesDesired } = surfacePose(surface);
  const selectedSurfaceId = useStore((s) => s.selectedSurfaceId);
  const selectSurface = useStore((s) => s.selectSurface);
  const openSurfaceEditor = useStore((s) => s.openSurfaceEditor);
  const selected = selectedSurfaceId === surface.id;

  // A falaknál egyoldalas render kell (befelé néző oldal), hogy 3D-ben belássunk a szobába.
  // A geometriai elülső oldaltól függően Front/Back, hogy tetszőleges körüljárásnál is jó legyen.
  // A dobozoldalaknál és padlónál minden oldalt mutatunk → DoubleSide.
  const side =
    surface.kind === 'wall'
      ? frontFacesDesired
        ? THREE.FrontSide
        : THREE.BackSide
      : THREE.DoubleSide;

  const onClick = interactive
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectSurface(surface.id);
      }
    : undefined;
  const onDouble = interactive
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        openSurfaceEditor(surface.id);
      }
    : undefined;

  return (
    <mesh position={position} quaternion={quaternion} onClick={onClick} onDoubleClick={onDouble}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        side={side}
        roughness={0.85}
        metalness={0}
        emissive={selected ? new THREE.Color('#2a4d6e') : new THREE.Color('#000000')}
        emissiveIntensity={selected ? 0.35 : 0}
      />
    </mesh>
  );
}
