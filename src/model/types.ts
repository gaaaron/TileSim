// Minden méret CENTIMÉTERBEN. A 3D scene méterben dolgozik: 1 cm = 0.01 world unit.
export const CM_TO_WORLD = 0.01;

export type Id = string;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Egy feltöltött kép hivatkozása (a blob az IndexedDB-ben él). */
export interface ImageRef {
  id: Id;
  name: string;
  /** Futásidőben generált object URL a megjelenítéshez (nem perzisztált). */
  url?: string;
}

/** Csempetípus: méret + egy vagy több kép (vegyes lerakáshoz). */
export interface TileType {
  id: Id;
  name: string;
  widthCm: number;
  heightCm: number;
  images: ImageRef[];
  /** Sima szín, ha nincs feltöltött kép (kép helyett ezzel renderel). */
  color: string;
  /** Fényesség 0..1 (0 = matt, 1 = fényes). A 3D-ben az érdesség-térképet vezérli. */
  glossiness: number;
  /** Fuga vastagság mm-ben. */
  groutMm: number;
  /** Fuga szín. */
  groutColor: string;
}

/** Szoba: alaprajz poligon (cm) + magasság. */
export interface Room {
  id: Id;
  name: string;
  /** Alaprajz pontok cm-ben, az XZ síkon (x→világ X, y→világ Z). Óramutató szerint. */
  floorPolygon: Vec2[];
  heightCm: number;
}

/** 3D doboz a térben. */
export interface Box {
  id: Id;
  name: string;
  /** Középpont alapja a padlón: pos.x, pos.z = vízszintes hely (cm), pos.y = alja magassága (cm). */
  pos: Vec3;
  /** Méret cm-ben: w (X), h (Y, magasság), d (Z). */
  size: { w: number; h: number; d: number };
  /** Forgatás Y tengely körül, fok. */
  rotationY: number;
  /** Melyik szobához tartozik (a pozíciója alapján; a szoba láthatóságát követi). */
  roomId?: Id;
}

/** Feltöltött 3D modell (GLB/glTF). A blob az IndexedDB-ben él. */
export interface ModelAsset {
  id: Id;
  name: string;
  /** A modell natív befoglaló mérete cm-ben (a méretezéshez; 1 modell-egység ≈ 1 m). */
  naturalSize: { w: number; h: number; d: number };
  /** Futásidejű object URL (nem perzisztált). */
  url?: string;
}

/** Elhelyezett 3D objektum (egy ModelAsset példánya). A dobozhoz hasonló mozgatás/méret. */
export interface SceneObject {
  id: Id;
  name: string;
  modelId: Id;
  /** pos.x/z = vízszintes hely (cm), pos.y = az alja magassága (cm). */
  pos: Vec3;
  /** Cél befoglaló méret cm-ben (a modellt erre skálázzuk). */
  size: { w: number; h: number; d: number };
  rotationY: number;
  roomId?: Id;
}

/** Elnevezett kedvenc szín (a projekttel együtt mentődik, minden színválasztónál elérhető). */
export interface FavoriteColor {
  id: Id;
  name: string;
  color: string;
}

/** Egy csempézhető felület típusa. */
export type SurfaceKind = 'floor' | 'ceiling' | 'wall' | 'box-face';

/**
 * Egy felület 2D (u,v) terét a világba leképező transzformáció.
 * worldPos(u,v) = origin + uAxis*(u*CM_TO_WORLD) + vAxis*(v*CM_TO_WORLD)
 * Az origin világ-koordinátában (méter), az uAxis/vAxis egységvektorok, normal a látható oldal felé néz.
 */
export interface SurfaceTransform {
  origin: Vec3;
  uAxis: Vec3;
  vAxis: Vec3;
  normal: Vec3;
}

export interface Surface {
  id: Id;
  kind: SurfaceKind;
  /** Emberi név, pl. "Padló", "Fal #2", "Doboz teteje". */
  label: string;
  /** A felület 2D mérete cm-ben. */
  widthCm: number;
  heightCm: number;
  transform: SurfaceTransform;
  subRegions: SubRegion[];
  /** Alap (csempe nélküli) szín, ha nincs subregion. */
  baseColor: string;
  /** El van-e rejtve a 3D megjelenítésben (származtatott a project.surfaceHidden-ből). */
  hidden?: boolean;
  /** A felület VALÓDI alakja a (u,v) térben (cm), ha nem téglalap (pl. L-padló). x=u, y=v. */
  outline?: Vec2[];
}

/** Pattern generátor neve. Bővíthető. */
export type PatternKind = 'grid' | 'offset' | 'herringbone';

export interface PatternConfig {
  generator: PatternKind;
  /** Az alapértelmezett csempetípus a generált cellákhoz. */
  defaultTileTypeId: Id | null;
  /** A csempe 90°-kal elforgatva kerüljön be a mintába (szélesség/magasság felcserélve). */
  tileRotated?: boolean;
  /** Forgatás fok (a teljes minta elforgatása a subregionon belül). */
  angleDeg: number;
  /** Origó eltolás cm-ben (u,v). */
  originOffset: Vec2;
  /** Generátor-specifikus paraméterek. */
  params: Record<string, number>;
}

/** Egy alterület a felületen belül: tetszőleges POLIGON a felület (u,v) terében (cm). x=u, y=v. */
export interface SubRegion {
  id: Id;
  /** A poligon csúcsai a felület (u,v) terében (cm); x=u, y=v. */
  polygon: Vec2[];
  pattern: PatternConfig;
  /** Cella-szintű csempetípus felülírások: cellId → tileTypeId. */
  tileOverrides: Record<string, Id>;
  /** Cella-szintű KÉP-index felülírások: cellId → a csempe images tömbjének indexe. */
  imageOverrides: Record<string, number>;
}

export interface Project {
  id: Id;
  name: string;
  tileTypes: TileType[];
  rooms: Room[];
  boxes: Box[];
  /** Feltöltött 3D modellek (GLB). */
  models: ModelAsset[];
  /** Elhelyezett 3D objektumok. */
  objects: SceneObject[];
  /** Felület-szerkesztések: surfaceId → SubRegion-ök. A felületek geometriája származtatott. */
  surfaceData: Record<string, SubRegion[]>;
  /** Elrejtett felületek: surfaceId → true (a 3D megjelenítésből kihagyva). */
  surfaceHidden: Record<string, boolean>;
  /** Elrejtett szobák: roomId → true (a padló + falai nem jelennek meg). */
  roomHidden: Record<string, boolean>;
  /** Felület alapszín-felülírás: surfaceId → szín (a származtatott alapszín helyett). */
  surfaceBaseColor: Record<string, string>;
  /** Elnevezett kedvenc színek (minden színválasztónál kiválaszthatók). */
  favoriteColors: FavoriteColor[];
}

export function uid(prefix = ''): Id {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
