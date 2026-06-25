import { useMemo } from 'react';
import { Surface } from '../model/types';
import { useStore } from '../store/projectStore';
import { FloorMesh } from './FloorMesh';
import { SurfacePlane } from './SurfacePlane';
import { BoxGroup } from './BoxGroup';

interface Props {
  mode: 'plan' | '3d';
}

/** A megosztott 3D tartalom: padlók, falak, dobozok – textúrázva. */
export function SceneContents({ mode }: Props) {
  const project = useStore((s) => s.project);
  const surfaces = useStore((s) => s.surfaces)();
  const clearSel = useStore((s) => s.selectBox);

  const byId = useMemo(() => {
    const m = new Map<string, Surface>();
    for (const s of surfaces) m.set(s.id, s);
    return m;
  }, [surfaces]);

  return (
    <group>
      {/* háttér-kattintás: kijelölés törlése */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => clearSel(null)}
        visible={false}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial />
      </mesh>

      {project.rooms.map((room) => {
        const floor = byId.get(`${room.id}:floor`);
        const walls = surfaces.filter((s) => s.id.startsWith(`${room.id}:wall:`));
        return (
          <group key={room.id}>
            {floor && <FloorMesh room={room} surface={floor} tileTypes={project.tileTypes} />}
            {mode === '3d' &&
              walls.map((w) => <SurfacePlane key={w.id} surface={w} tileTypes={project.tileTypes} />)}
          </group>
        );
      })}

      {project.boxes.map((box) => {
        const faces = surfaces.filter((s) => s.id.startsWith(`${box.id}:face:`));
        return (
          <BoxGroup key={box.id} box={box} faces={faces} tileTypes={project.tileTypes} mode={mode} />
        );
      })}
    </group>
  );
}
