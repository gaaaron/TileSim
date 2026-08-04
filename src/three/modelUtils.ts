import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/** Betölt egy GLB/glTF blobot és visszaadja a natív befoglaló méretét (modell-egységben). */
export async function loadModelBBox(blob: Blob): Promise<{ x: number; y: number; z: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { x: size.x || 1, y: size.y || 1, z: size.z || 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
