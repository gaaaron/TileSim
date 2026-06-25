import * as THREE from 'three';
import { CM_TO_WORLD, Surface, Vec3 } from '../model/types';
import { surfaceToWorld } from '../model/geometry';

const v = (a: Vec3) => new THREE.Vector3(a.x, a.y, a.z);

/** Egy planáris felülethez (fal, doboz-oldal) pozíció + orientáció a PlaneGeometry-hez. */
export function surfacePose(surface: Surface): {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  width: number;
  height: number;
  /** A geometriai elülső oldal (u×v) a kívánt látható normál felé néz-e. */
  frontFacesDesired: boolean;
} {
  const t = surface.transform;
  const center = surfaceToWorld(t, surface.widthCm / 2, surface.heightCm / 2);
  const u = v(t.uAxis).normalize();
  const vv = v(t.vAxis).normalize();
  // MINDIG jobbkezes bázis: a harmadik tengely u×v, így a mátrix valódi forgatás
  // (det +1), nem tükrözés – különben a kvaternió hibás lenne (tetők/aljak elforgatva).
  const nGeo = new THREE.Vector3().crossVectors(u, vv).normalize();
  const m = new THREE.Matrix4().makeBasis(u, vv, nGeo);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(m);
  const desired = v(t.normal).normalize();
  return {
    position: new THREE.Vector3(center.x, center.y, center.z),
    quaternion,
    width: surface.widthCm * CM_TO_WORLD,
    height: surface.heightCm * CM_TO_WORLD,
    frontFacesDesired: nGeo.dot(desired) >= 0,
  };
}
