import { useMemo } from 'react';
import * as THREE from 'three';
import { Surface, TileType } from '../model/types';
import { renderSurfaceCanvas, surfaceImageUrls } from '../render/SurfaceTexture';
import { useImages } from '../render/imageCache';

/** Egy felület élő CanvasTexture-je, ami frissül a subRegion/kép változásokra. */
export function useSurfaceTexture(surface: Surface, tileTypes: TileType[]): THREE.CanvasTexture {
  const urls = useMemo(() => surfaceImageUrls(surface, tileTypes), [surface, tileTypes]);
  const images = useImages(urls);

  // a felület „aláírása": ha változik, újrarajzoljuk a canvast
  const sig = useMemo(
    () => JSON.stringify(surface.subRegions) + '|' + surface.widthCm + 'x' + surface.heightCm,
    [surface],
  );

  return useMemo(() => {
    const { canvas } = renderSurfaceCanvas(surface, tileTypes, images);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false; // canvas (u,v top-left) → UV (0,0) top-left
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, images, tileTypes]);
}
