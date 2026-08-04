import { useMemo } from 'react';
import * as THREE from 'three';
import { Surface, TileType } from '../model/types';
import { renderSurfaceCanvas, surfaceImageUrls } from '../render/SurfaceTexture';
import { useImages } from '../render/imageCache';

interface SurfaceTextures {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/** Egy felület élő szín- + érdesség-textúrája, ami frissül a subRegion/kép/csempe változásokra. */
export function useSurfaceTexture(surface: Surface, tileTypes: TileType[]): SurfaceTextures {
  const urls = useMemo(() => surfaceImageUrls(surface, tileTypes), [surface, tileTypes]);
  const images = useImages(urls);

  // a felület „aláírása": ha változik, újrarajzoljuk a canvast
  const sig = useMemo(
    () =>
      JSON.stringify(surface.subRegions) +
      '|' +
      surface.widthCm +
      'x' +
      surface.heightCm +
      '|' +
      surface.baseColor,
    [surface],
  );

  return useMemo(() => {
    const { canvas, roughnessCanvas } = renderSurfaceCanvas(surface, tileTypes, images);
    const map = new THREE.CanvasTexture(canvas);
    map.flipY = false; // canvas (u,v top-left) → UV (0,0) top-left
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
    roughnessMap.flipY = false;
    roughnessMap.needsUpdate = true; // lineáris (nem sRGB)
    return { map, roughnessMap };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, images, tileTypes]);
}
