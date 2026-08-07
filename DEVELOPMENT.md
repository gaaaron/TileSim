# TileSim — Fejlesztői dokumentáció

> **Cél:** ez a dokumentum önállóan elég ahhoz, hogy bárki (akár egy AI, előzetes
> kontextus nélkül) tovább tudja fejleszteni a kódot. **SZABÁLY: minden kód-változásnál
> frissítsd ezt a fájlt** (érintett szakasz + a végén a Changelog). Lásd a dokumentum
> végén a „Dokumentációs szabály" pontot.

---

## 1. Mi ez?

Csempe-elrendezés szimulátor webapp. A felhasználó:
1. **Csempetípusokat** definiál (név, méret cm-ben, egy vagy több feltöltött kép, fuga).
2. **Szobát** hoz létre (pontos méretű téglalap, vagy szabad poligon az alaprajzon) + magasság.
3. **3D dobozokat** tesz a térbe, átméretez/forgat/mozgat.
4. A **falak / padló / dobozoldalak** felületét oldalanként csempézi: alterületeket rajzol,
   mintát választ (rács / kötés / halszálka, elforgatható), cellákat jelöl ki és csempét rendel hozzájuk.
5. Két nézet: **alaprajz** (felülnézet) és **3D** — ugyanaz a three.js scene, így a textúrák mindkettőben látszanak.

## 2. Tech stack és futtatás

- **Vite + React 18 + TypeScript** (`npm run dev` / `build` / `test`).
- **three.js + @react-three/fiber (R3F) + @react-three/drei** — 3D render.
- **zustand** — globális állapot + undo/redo + autosave.
- **idb** — IndexedDB wrapper (projekt JSON + kép-blobok).
- **vitest** — unit teszt (pattern-generátorok).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit + vite build
npm test         # vitest
```

## 3. Koordináta-rendszerek és mértékegységek (FONTOS)

- **Minden tárolt méret centiméterben.** Konstans: `CM_TO_WORLD = 0.01` (`src/model/types.ts`).
  A 3D scene méterben dolgozik: `world = cm * CM_TO_WORLD`.
- **Alaprajz sík:** az XZ sík. A poligon-pontok `Vec2{x,y}` alakúak, ahol `x → világ X`,
  `y → világ Z` (tehát a 2D „y" valójában a mélység/Z). Y a magasság (felfelé).
- **Felület (surface) 2D tér `(u,v)`:** minden csempézhető lapnak van egy saját 2D koordinátarendszere
  cm-ben. Egy `(u,v)` pont világ-pozíciója:
  `world = origin + uAxis*(u*CM_TO_WORLD) + vAxis*(v*CM_TO_WORLD)` (lásd `SurfaceTransform`).
- **Canvas textúra:** `(u,v)` → canvas pixel: **u jobbra, v lefelé**, bal-felső origó.
  A textúrán `flipY = false`, így a canvas (0,0) bal-felső pixel a UV (0,0)-ra kerül (lásd 7. és 8.4).

## 4. Fájltérkép (`src/`)

```
model/
  types.ts        # MINDEN adattípus + CM_TO_WORLD + uid()
  geometry.ts     # poligon→padló/falak, doboz→6 oldal, surfaceToWorld(), bbox, terület
patterns/         # PATTERN-MOTOR (bővíthető)
  types.ts        # PatternGenerator interfész, TilePlacement, PatternContext, Size
  grid.ts         # szimmetrikus rács
  offset.ts       # kötésben eltolt (brick bond)
  herringbone.ts  # halszálka (90°-os; a vizuális 45°-ot az angleDeg adja, lásd 6.3)
  registry.ts     # getGenerator(kind), allGenerators()
  patterns.test.ts# hézag-/átfedés teszt mindhárom generátorra
render/
  SurfaceTexture.ts # subRegionTiles() + renderSurfaceCanvas() + surfaceImageUrls()
  tilePicker.ts     # imageIndexFor/pickImageUrl: per-cella kép-index override VAGY cellId-hash
  imageCache.ts     # kép betöltés + useImages() React hook
three/
  pose.ts            # surfacePose(): felület → 3D pozíció + kvaternió (JOBBKEZES bázis!)
  useSurfaceTexture.ts # Surface → élő szín- + érdesség-CanvasTexture ({map, roughnessMap})
  SurfacePlane.tsx   # fal / doboz-oldal mint textúrázott plane (Front/Back/DoubleSide)
  FloorMesh.tsx      # padló-poligon háromszögelve + textúra; plan: él-közeli dupla katt → új csúcspont
  BoxGroup.tsx       # doboz 6 oldala + plan-nézeti húzás (+ kamera-lock + beginDrag/endDrag)
  ObjectGroup.tsx    # elhelyezett GLB objektum (useGLTF) + plan-húzás (mint a doboz)
  modelUtils.ts      # loadModelBBox: GLB blob → natív befoglaló méret (GLTFLoader, three-stdlib)
  SceneContents.tsx  # a megosztott 3D tartalom (padlók, falak, dobozok, objektumok)
  RoomEditingLayer.tsx # alaprajzi szoba-RAJZOLÁS + csúcspont-szerkesztés (lásd 9.3)
views/
  PlanView.tsx       # alaprajz: ortografikus felülnézet, szoba-rajzolás
  View3D.tsx         # 3D: perspektív + OrbitControls + fények
  SurfaceEditor.tsx  # MODAL oldal-szerkesztő (alterület, minta, forgatás, cellák)
panels/
  RoomsPanel.tsx     # téglalap-szoba gyorslétrehozás + szoba-lista (sorra katt/dupla-katt = RoomEditor)
  RoomEditor.tsx     # szoba popup: név, X-Y pozíció (eltolás), magasság, csoportos fal-alapszín
  TileLibraryPanel.tsx # csempetípusok + képfeltöltés + fuga; a kártya fejlécére kattintva szerkesztő popup
  TileInspector.tsx  # kijelölt csempe szerkesztő popupja (név, méret, fuga) – updateTileType
  SurfacesPanel.tsx  # „Oldalak" csoport: minden felület + láthatóság-checkbox + sorra katt = szerkesztő
  ObjectsPanel.tsx   # GLB feltöltés + modellből példány elhelyezése + elhelyezett objektumok listája
  BoxInspector.tsx   # kijelölt doboz méret/pozíció popup
  ObjectInspector.tsx # kijelölt 3D objektum méret/pozíció popup (mint a dobozé)
  FavoriteColorsManager.tsx # kedvenc-szín popup: jelenlegi szín mentése + kiválasztás (a hívó mezőre) + név/szín szerk., törlés
ui/
  CollapsibleGroup.tsx # összecsukható oldalpanel-csoport (akkordeon)
  ColorField.tsx     # kompakt színválasztó: natív input + EGYETLEN ★ ikon → kedvenc-popup (mentés/kiválasztás ott)
  useColorCommit.ts  # szín onChange → EGY undo-lépés + rAF-ritkított store-frissítés (kevesebb újrarajzolás)
  ErrorBoundary.tsx  # egy nézet hibája (pl. nincs WebGL) ne döntse le az egész appot
store/projectStore.ts # zustand store (állapot + akciók + undo/redo + autosave)
db/storage.ts         # IndexedDB: projekt + kép-blobok, hydrateImageUrls()
App.tsx, main.tsx, styles.css, vite-env.d.ts
```

## 5. Adatmodell (`model/types.ts`)

- **`TileType`**: `{ id, name, widthCm, heightCm, images: ImageRef[], color, glossiness, groutMm, groutColor }`.
  A `color` kép híján a csempe sima színe; a `glossiness` (0..1) a 3D fényességet adja (érdesség-térképen át).
  Egy típushoz több kép is tartozhat → vegyes lerakás.
- **`ImageRef`**: `{ id, name, url? }`. A blob az IndexedDB-ben él; az `url` futásidejű object URL
  (nem perzisztált; betöltéskor `hydrateImageUrls` állítja elő).
- **`Room`**: `{ id, name, floorPolygon: Vec2[] (cm, XZ), heightCm }`.
- **`ModelAsset`** (feltöltött GLB): `{ id, name, naturalSize:{w,h,d} (cm), url? }`. A blob az IndexedDB
  generikus blob-tárában (`saveImageBlob`/`loadImageBlob`); `naturalSize` = a natív befoglaló × 100
  (1 modell-egység ≈ 1 m → cm). Az `url` futásidejű object URL (hidratált, nem perzisztált).
- **`SceneObject`** (elhelyezett objektum): `{ id, name, modelId, pos, size:{w,h,d}, rotationY, roomId? }`.
  Mint a `Box`, de GLB-t renderel; `size` = cél befoglaló (cm), a render skálázza (`size/naturalSize`).
- **`Box`**: `{ id, name, pos:{x,y,z}, size:{w,h,d}, rotationY, roomId? }`. `pos.x/z` = vízszintes hely,
  `pos.y` = a doboz **aljának** magassága; a doboz közepe `(pos.x, pos.y+h/2, pos.z)`. A `roomId` a doboz
  szobája (a pozíciója alapján `roomForPoint`-tal; `addBox`/`updateBox`/migráció állítja); a doboz a szoba
  láthatóságát követi (`SceneContents` kihagyja, ha a szobája rejtett).
- **`Surface`** (származtatott geometria, lásd 6.1): `{ id, kind:'floor'|'ceiling'|'wall'|'box-face', label,
  widthCm, heightCm, transform: SurfaceTransform, subRegions: SubRegion[], baseColor }`.
- **`SurfaceTransform`**: `{ origin, uAxis, vAxis, normal }` (origin világ-méterben, a tengelyek egységvektorok).
- **`SubRegion`**: `{ id, polygon: Vec2[] (cm a felület (u,v) terében; x=u, y=v), pattern: PatternConfig,
  tileOverrides: Record<cellId, tileTypeId>, imageOverrides: Record<cellId, number> }`.
  Az `imageOverrides` egy cella KÉP-indexét rögzíti a csempe `images` tömbjén belül (textúra-léptetés /
  véletlen kiosztás); ha nincs override, a `cellId` hash determinisztikusan választ.
  Az alterület **tetszőleges poligon** (nem csak téglalap).
  A befoglaló téglalapot a `subRegionBBox(sub)` adja. Régi `rect`-es mentés betöltéskor 4-csúcsú
  poligonná migrálódik (store `init`).
- **`Surface.outline?`**: a felület VALÓDI alakja a (u,v) térben (cm), ha nem téglalap (pl. L-padló).
  A `floorSurface` állítja be a szoba poligonjából; a szerkesztő ezzel sötétíti a körvonalon kívüli részt.
- **`PatternConfig`**: `{ generator:'grid'|'offset'|'herringbone', defaultTileTypeId, angleDeg,
  originOffset:{x,y}, params: Record<string,number>, tileRotated? }`. A `tileRotated` a csempét 90°-kal
  forgatva használja a mintában (a `subRegionTiles` felcseréli a `tile.w/h`-t, a renderer a képet is 90°-kal
  forgatja) — pl. kötésben a csempe a másik oldalával kerül a sorba.
- **`Project`**: `{ id, name, tileTypes[], rooms[], boxes[], surfaceData, surfaceHidden, roomHidden }`.
  A `roomHidden: Record<roomId, boolean>` egész szobákat rejt (padló + falai); a `SceneContents` és a
  `RoomEditingLayer` kihagyja őket. UI: checkbox a `RoomsPanel` sorában (`toggleRoomHidden`).
  A `surfaceBaseColor: Record<surfaceId, szín>` felülírja egy felület származtatott alapszínét (a
  csempe nélküli rész színe); a `surfaces()` szelektor alkalmazza. Egyedi: `setSurfaceBaseColor` (SurfaceEditor
  fejléc-színválasztó); csoportos: `setRoomSurfacesBaseColor` a szoba MINDEN oldalára (`RoomEditor`).
  A `favoriteColors: FavoriteColor[]` ({id,name,color}) elnevezett kedvenc színek — a projektben mentve
  (export/import, undo). Akciók: `addFavoriteColor(color,name?)`, `updateFavoriteColor`, `removeFavoriteColor`,
  `openFavoriteColors(target|null)` — a `target = {color, onPick}` a `favoritePicker` UI-state, amiből a popup
  tudja, MELYIK mezőnek adja vissza a kiválasztott színt. Minden színválasztó a **kompakt `ColorField`**:
  natív input + EGYETLEN ★ ikon, ami a popupot nyitja (helyben nem foglal helyet). A `FavoriteColorsManager`
  popupban történik a jelenlegi szín **mentése** (★ Mentés; „Már mentve", ha már benne van) ÉS a **kiválasztás**
  (swatch-ra katt → `onPick` a hívó mezőre, majd zár), plusz név/szín szerkesztés és törlés. Használat:
  SurfaceEditor, RoomEditor, TileInspector (szín+fuga), TileLibraryPanel (fuga). App-szinten mountolt (`favoritePicker &&`).

  **Fontos:** a felületek geometriája NINCS tárolva — a szobákból/dobozokból **származtatott**
  (lásd 6.1). Csak a felülethez tartozó `subRegions` perzisztálódik `surfaceData[surfaceId]` alatt.

## 6. Geometria és pattern-motor

### 6.1 Felület-származtatás (`model/geometry.ts`)
- `floorSurface(room)`: padló-felület; `(u,v)` a poligon befoglaló téglalapja; `uAxis=+X, vAxis=+Z, normal=+Y`.
- `ceilingSurface(room)`: mennyezet — mint a padló, de `y=heightCm`-en, `normal=-Y` (lefelé). Id `:ceiling`.
- `wallSurfaces(room)`: minden poligon-élhez egy fal; `u` = él menti hossz, `v` = magasság;
  a `normal` **befelé** mutat (a centroid felé; szükség esetén megfordítva).
- `boxFaceSurfaces(box)`: a doboz 6 oldala, a `rotationY` figyelembevételével (`rotateY`).
- `allSurfaces(rooms, boxes)`: az összes felület geometriája (subRegion adat nélkül).
- A store `surfaces()` szelektora ezt hívja, és ráteszi a `surfaceData`-ból a `subRegions`-t.
- Surface id-k: `"<roomId>:floor"`, `"<roomId>:wall:<i>"`, `"<boxId>:face:<front|back|left|right|top|bottom>"`.

### 6.2 Pattern-generátor interfész (`patterns/types.ts`)
```ts
interface PatternGenerator {
  name: PatternKind; label: string;
  paramSpec: Record<string,{label,def,min,max,step}>; // UI csúszkák
  generate(bounds: Size, ctx: PatternContext): TilePlacement[];
}
// TilePlacement = { cellId, x, y, w, h, rotationDeg }  // x,y = BAL-FELSŐ sarok, cm
// PatternContext = { tile:{w,h}, params, originOffset }
```
A generátorok **abutáló** (hézag nélküli) csempéket adnak. A **fugát a renderer teszi hozzá**
(minden csempét `grout/2`-vel beljebb rajzol), így a fuga egységes minden mintára.

### 6.3 Meglévő generátorok
- **`grid`**: azonos méretű csempék rácsban. Lép = csempe méret.
- **`offset`**: minden sor eltolva (`params.offset` = csempe-arány, def 0.5).
- **`herringbone`**: 90°-os halszálka. A **cellák mérete = a csempe valódi mérete**
  (`L=max(w,h)`, `W=min(w,h)`). Motívum: `H=(0,0,L,W)` + `V=(L,0,W,L)`. Rács-vektorok
  `v1=(W,L+W), v2=(W,-W)` — ezek hézag-/átfedésmentesen töltik a síkot, **ha L=2W** (klasszikus 2:1
  csempe). Más aránynál a cella a csempe méretét tartja, de az illeszkedésnél kis hézag/átfedés van
  (ez geometriai szükségszerűség — valódi halszálka 2:1 csempét igényel).
  A **vizuális 45°-os halszálkát** nem a generátor adja, hanem a `PatternConfig.angleDeg`
  (a minta a rect közepe körül forog, lásd 7). A SurfaceEditor a halszálka kiválasztásakor
  automatikusan 45°-ra állítja az `angleDeg`-et, ha az még 0.

### 6.4 Új minta hozzáadása (recept)
1. Új fájl `patterns/<nev>.ts`, exportálj egy `PatternGenerator`-t (kövesd a `grid.ts`-t).
2. Regisztráld `patterns/registry.ts`-ben (`generators` map + a `PatternKind` típus bővítése `types.ts`-ben).
3. Adj hozzá esetet `patterns.test.ts`-hez (hézag-/átfedés-ellenőrzés).
4. A render/UI **nem igényel** módosítást (a registry + paramSpec automatikusan bekötik).
   Több méretű csempés minták (Versailles): a `generate` többféle `w/h`-jú `TilePlacement`-et adhat vissza.

## 7. Render pipeline (`render/SurfaceTexture.ts`) — a lényeg

`subRegionTiles(sub, tileTypes): CellTile[]` — a megjelenítés/kijelölés közös forrása.
`CellTile = { cellId, cx, cy, w, h, rotationDeg, tileTypeId }` ahol **`cx,cy` = a csempe KÖZÉPPONTJA**
a felület `(u,v)` terében (cm). Az itteni „rect" = az alterület **poligonjának befoglalója**
(`subRegionBBox(sub)`). Lépések:
1. Az alapcsempe mérete a `defaultTileTypeId`-ból (fallback 40×40).
2. Ha `angleDeg ≈ 0`: a generátort a rect méretére hívjuk, a rect-et metsző cellákat tartjuk, és
   sarok→középpont konverzió.
3. Ha `angleDeg ≠ 0`: nagyobb területre generálunk (`rect + 2*margin`, `margin=átló`), majd minden
   csempe-középpontot a **rect közepe körül** elforgatunk `angleDeg`-gel; a rect-en kívüli cellákat eldobjuk.
   A cella `rotationDeg = angleDeg`.

`renderSurfaceCanvas(surface, tileTypes, images)`:
- Canvas mérete `widthCm*ppc × heightCm*ppc` (`ppc` = pixel/cm, max ~2048 px-re skálázva).
- Felületenként/alterületenként: klippelés az alterület **poligonjára**, fuga-háttér kitöltés, majd minden cellára:
  `translate(cx,cy) → rotate(rotationDeg) → drawImage középre igazítva, grout/2 behúzással`.
  **Kép hiányában a csempe `color`-ja** (sima szín).
- Egyúttal egy **érdesség-térképet** is rajzol (`roughnessCanvas`): minden cella a fényességéből számolt
  szürkeárnyalattal (`roughGray(glossiness)`; matt = világos, fényes = sötét), a fuga matt.
- Visszaad `{canvas, roughnessCanvas, ppc}`. A `useSurfaceTexture` ebből `{map, roughnessMap}` CanvasTexture-t
  ad (a `map` sRGB+flipY=false; a `roughnessMap` lineáris). A 3D anyagok: `map`, `roughnessMap`, `roughness=1`
  (így a térkép vezérli a fényességet).

`surfaceImageUrls(surface, tileTypes)`: az előtöltendő kép-url-ek (a `useImages` hookhoz).

## 8. 3D réteg

### 8.1 `useSurfaceTexture(surface, tileTypes)`
Memoizált `THREE.CanvasTexture`. Újrarajzol, ha a `subRegions` aláírás (JSON) vagy a betöltött képek
változnak. `flipY=false`, `colorSpace=SRGB`.

### 8.2 `pose.ts` → `surfacePose(surface)` — JOBBKEZES bázis (gotcha!)
Visszaad `{ position, quaternion, width, height, frontFacesDesired }`. A bázist **mindig jobbkezesként**
építi: a harmadik tengely `nGeo = uAxis × vAxis` (NEM a tárolt `normal`!), különben a mátrix tükrözés
(det −1) lenne, amiből a `setFromRotationMatrix` **hibás kvaterniót** ad (a doboz teteje/alja elforgatva
jelent meg). A `frontFacesDesired = nGeo · normal ≥ 0` jelzi, hogy a geometriai elülső oldal a kívánt
látható normál felé néz-e (a falak culling-jához, lásd 8.3).

### 8.3 `SurfacePlane.tsx` (fal / doboz-oldal)
Egy `planeGeometry` a `surfacePose` szerint elhelyezve, `useSurfaceTexture` map-pel. **Oldalasság:**
- **fal:** egyoldalas, hogy 3D-ben be lehessen látni a szobába (a kamera felőli közeli fal kiesik).
  `frontFacesDesired ? FrontSide : BackSide` — így tetszőleges alaprajz-körüljárásnál is a befelé néző
  oldal látszik.
- **doboz-oldal / egyéb:** `DoubleSide` — minden oldal látszik bármely nézőpontból.
`interactive` prop: 3D-ben true (klikk=kijelöl, duplaklikk=szerkesztő nyit), plan-ben false (a BoxGroup kezeli).

### 8.4 `FloorMesh.tsx`
A padló-poligont `THREE.ShapeUtils.triangulateShape`-pel háromszögeli, a vertexeket
`(x*cm, y, z*cm)`-re teszi, a UV-t a befoglaló téglalapra normálja (`(x-minX)/w, (z-minZ)/h`).
Padlón `DoubleSide`. Klikk = felület kijelölés. **Dupla katt:** plan nézetben, ha él-közeli (`nearestEdge`
≤ `EDGE_INSERT_CM`) → `insertRoomVertex` (új csúcspont), egyébként csempe-szerkesztő nyit.
**`ceiling` prop:** ugyanez a komponens rajzolja a mennyezetet is — ekkor `y = heightCm*cm`, `FrontSide`
(a háromszögelés normálja lefelé mutat, így belülről/alulról látszik, felülről kulloz → nem takarja a
felülnézeti 3D nézetet), és nincs él-beszúrás dupla kattra (mindig a csempe-szerkesztőt nyitja).
**Világítás-gotcha:** a lefelé néző mennyezetet felülről nem éri fény (a `directionalLight`-ok elfordulnak
tőle, a `hemisphereLight` a *talaj*-színt adja rá), így a fehér is szürkére sötétedne. Nincs global
illumination (nincs padló-visszaverődés). Cél: azonos alapszínnél a mennyezet és a falak ~egyformák legyenek.
Megoldás két részből: (1) a világítás irány-független részét erősítjük — `ambient 0.55`, a `hemisphereLight`
talaj-színe világosabb `#6d6d78` (a lefelé néző felület ezt a teljes színt kapja), lásd `View3D`; (2) a
mennyezet a saját textúráját kicsit **önti** (`emissive=#fff, emissiveMap=map, emissiveIntensity=0.15`),
pótolva a hiányzó directional-t. Csak a mennyezetnél; padlón/falon `emissive=0`.

### 8.5 `BoxGroup.tsx`
A doboz 6 `SurfacePlane` oldala egy `<group>`-ban. **Plan nézetben húzható:** `pointerdown`→`pointerup`
a földsíkra (`y=0`) raycastol, és frissíti `box.pos.x/z`-t. **Kamera-lock (gotcha):** húzás kezdetén
`controls.enabled=false` (a `useThree(s=>s.controls)`-ból), `pointerup`-nál vissza `true` — különben a
`MapControls` is pásztázna a húzással. `beginDrag()/endDrag()` → egy undo-lépés / húzás. Kijelölt dobozhoz `BoxOutline` drótváz.

### 8.5b `ObjectGroup.tsx` (elhelyezett GLB objektum)
`useGLTF(model.url)` betölti a GLB-t (Suspense kell köré — a `SceneContents` `<Suspense fallback={null}>`-be
csomagolja). A scene-t **példányonként klónozzuk** (`scene.clone(true)`), mert egy node csak egy helyen lehet.
A klón befoglalójából (`Box3`) számolt `center/min` szerint a modellt az origóra (alja-középre) toljuk, majd
`size/naturalSize` arányban skálázzuk. Plan-húzás/kijelölés/kamera-lock: ugyanaz, mint a `BoxGroup`-nál
(`updateObject`/`selectObject`). Kijelöléskor drótváz-doboz a `size` méretben.

### 8.6 `SceneContents.tsx`
A megosztott tartalom (mindkét nézet használja, `mode:'plan'|'3d'` prop). Szobánként `FloorMesh` (padló) +
**mennyezet** (`FloorMesh ceiling`, csak 3D-ben) + falak (`SurfacePlane`, csak 3D-ben), dobozonként `BoxGroup`,
objektumonként `ObjectGroup` (Suspense-ben). A mennyezet plan nézetben nem jelenik meg (felülnézetből eltakarná
a padlót). A rejtett szobájú dobozok/objektumok kimaradnak. Egy láthatatlan földsík `onClick`-je törli a kijelölést.

## 9. Nézetek

### 9.1 `PlanView.tsx` (alaprajz)
`<Canvas>` + `OrthographicCamera` fentről (`position=[2,50,2]`, **`up=[0,0,-1]`** — különben a lefelé néző
kamera up-vektora degenerált és 45°-kal elfordulna a kép!), `zoom=120` (1 world = 120 px). `MapControls`
`enableRotate={false}` (csak pan+zoom). Szoba-rajzolás módban egy láthatatlan sík `onClick`-je adja a
pontokat (cm-re kerekítve); a vázlat-poligon `drei <Line>` + gömbök.

### 9.2 `View3D.tsx`
Perspektív kamera + `OrbitControls` + `ambient/hemisphere/directional` fények. **Procedurális környezet**
(`<Environment>` + `<Lightformer>`-ek, offline, hálózat nélkül): ez adja a `scene.environment`-et, amit a
`MeshStandardMaterial`-ek automatikusan használnak — **enélkül a fényes (alacsony érdességű) csempék nem
látszanának fényesnek**, mert nincs mit tükrözniük (csak egy aprócska direkt-fény csúcsfény lenne).

### 9.3 `RoomEditingLayer.tsx` (alaprajzi rajzolás + csúcspont-szerkesztés)
A PlanView Canvas-án belül fut. Világ↔képernyő: `screenToCm()` a kamerából raycastol a földsíkra
(ortho/perspektív független). A húzások **window-szintű** `pointermove/pointerup` listenerekkel mennek
(robusztusabb, mint az R3F hit-routing); a húzás magja egy ref-ben (`core`) lakik, amit a Shift-billentyű
listenerei is hívhatnak (élő „kiegyenesítés").
- **Rajzolás** (`planTool==='draw-room'`): a földsík `onPointerDown`-ja új pontot tesz le ÉS azonnal húzni
  kezdi → a fal a lenyomásra látszik, a kurzort követi, felengedésre rögzül. **Shift**: a szakasz a
  `prev` ponthoz képest 45°-os rácsra ugrik (`snapAngle`). A kezdőpont közelébe (`CLOSE_CM`) kattintva a
  poligon záródik (`commitDraftRoom`). A `MapControls`-t húzás idejére kikapcsoljuk.
- **Szerkesztés** (`select` mód): minden szoba kontúr (`<Line>`) + falhossz-címkék (`<Html>`) +
  **mozgatható csúcspont-gömbök**. Csúcspont húzása → `moveRoomVertex` (egy undo / húzás: `beginDrag/endDrag`).
  Csúcsponton kattintás (mozgás nélkül) → **context menu** (`<Html>`) „Pont törlése" gombbal (`deleteRoomVertex`,
  min. 3 pont). **Él dupla-kattintás → új csúcspont**: ezt a `FloorMesh.onDoubleClick` kezeli (megbízható nagy
  találati felület): plan nézetben, ha a kattintás `EDGE_INSERT_CM`-en belül van egy élhez → `insertRoomVertex`,
  egyébként a csempe-szerkesztő nyílik. A magasságot a toolbar állítja (`draftHeightCm`).

## 10. Felület-szerkesztő (`views/SurfaceEditor.tsx`)
Modal, sima 2D `<canvas>` (NEM WebGL → akkor is működik, ha a 3D nézet hibázik). A felület textúráját a
`renderSurfaceCanvas` adja (`drawImage` skálázva), fölé rajzolódnak a poligonok/cellák/kijelölés. Ha a
felületnek van `outline`-ja (pl. L-padló), a körvonalon kívüli rész **elsötétül** (even-odd kitöltés) →
a valódi alak látszik (mint az alaprajzon). Két mód:
- **`region`** (Alterületek) — az alterület **poligon**, az alaprajzi szoba-szerkesztéshez hasonlóan:
  - üres helyre húzva **új** (téglalap-)alterület (`addSubRegion` poligonnal),
  - **csúcspont húzása** = vertex mozgatás (`moveSubRegionVertex`),
  - **belül húzva** az egész alterület mozog (`translatePoly` + `updateSubRegionPolygon`),
  - **dupla katt egy élre** → új csúcspont (`nearestEdge` + `insertSubRegionVertex`),
  - **csúcspontra kattintva** (mozgás nélkül) → context menu „Pont törlése" (`deleteSubRegionVertex`, ≥3).
  A `beginDrag`-et csak az első tényleges mozdulatnál hívjuk (≥2 cm) → klikk ≠ undo-lépés; húzás = egy lépés.
  Az aktív alterület **él-hosszai** (cm) is látszanak a vászonra rajzolt címkékként (mint az alaprajzon a
  falhosszok). Csúcs-húzás közben **Shift** = derékszög-igazítás: a `snapRightAngle` a húzott csúcsot a két
  szomszédjához igazítja tengely-igazított (90°-os) élekké.
  **Numerikus átméretezés:** „Méret (cm)" szakasz egy **3×3 pivot-ráccsal** (mi maradjon helyben: sarkok,
  oldalfelezők, középpont) + szélesség/magasság mezőkkel. A `resizeActiveSub` a poligont a pivot körül
  skálázza az új befoglaló-méretre (`sx=W/bb.w, sy=H/bb.h`); falaknál a pivot sorát `flipV` szerint tükrözi.
  **Numerikus pozíció:** „Pozíció (cm)" X/Y mezők — a `moveActiveSubTo` a poligont a megadott (megjelenített)
  bal-felső sarokra tolja (falaknál a Y-t `flipV`-vel a látott orientációhoz igazítja).
- **`cells`**: klikk = egy cella toggle, húzás = gumikeret (a cella **középpontja** alapján). A kijelölés a
  **poligonra van vágva** (`pointInPolygon`). A cellák elforgatottak lehetnek (`rotationDeg`), ezért a
  találat a pontot a cella lokális keretébe transzformálja. **Textúra-vezérlők** (ha a csempének >1 képe van):
  „⟳ Textúra léptetése" a kijelölt cellák kép-indexét lépteti (`imageIndexFor`+1, wrap), „🎲 Véletlen kiosztás"
  az alterület MINDEN cellájára véletlen kép-indexet ad. Mindkettő a `setCellImageOverrides`-on át ír
  `imageOverrides`-ba; a base-textúra automatikusan újrarajzolódik.
A `renderSurfaceCanvas` és a cella-réteg az alterületet a **poligonjára klippeli** (nem a befoglalóra), így
nem-téglalap alterületen is pontosan jelenik meg.

**Függőleges tükrözés falaknál (`flipV`):** a falak (és függőleges doboz-oldalak) `(u,v)` terében `v=0` a
**padló** (a `transform.vAxis` felfelé mutat). A szerkesztő `v`-t alapból lefelé rajzolja, ezért ezeknél a
felületeknél a megjelenítést **függőlegesen tükrözzük** (`flipV = vAxis.y > 0.5`): a `vy(v)` helper a
rajzoláshoz, a `toXY` az egér→(u,v) leképzéshez tükröz, az alap-textúrát `scale(1,-1)`-gyel rajzoljuk, a
forgatott cellák szögét negáljuk. Így a vászon ALJA = a fal alja (padló) — egyezik a 3D-vel és az
intuícióval. A padlónál (`vAxis.y≈0`) nincs flip (a felülnézettel egyezik).
A minta-vezérlők: generátor választó (halszálkánál auto 45°), alap csempe, **Elforgatás csúszka + 0/30/45/90°
gombok** (`angleDeg`), generátor-paraméterek (`paramSpec`), `originOffset`. Cella-kijelöléshez csempe-hozzárendelés.

## 10b. Oldalpanel (App sidebar) + felület-láthatóság
- A bal panel elemei **`CollapsibleGroup`** akkordeonokban: „Szobák" (`RoomsPanel`), „Oldalak"
  (`SurfacesPanel`, alapból csukva), „Csempék" (`TileLibraryPanel`). A panelek belső `<h3>` címe
  megszűnt — a címet a csoport adja.
- **Felület-láthatóság:** `project.surfaceHidden: Record<surfaceId, boolean>`. A `surfaces()` szelektor
  `hidden` mezőt is ad. A `SceneContents` a `!s.hidden` felületeket **nem rendereli** (fal/padló/doboz-oldal).
  Kapcsolók: a `SurfacesPanel` minden sorában checkbox (`toggleSurfaceHidden`), és a `SurfaceEditor`
  fejlécében „Látható" checkbox. Mivel rejtett fal 3D-ben nem kattintható, a szerkesztője az „Oldalak"
  panel sorára kattintva (`openSurfaceEditor`) nyitható.
- **ErrorBoundary:** a `App.viewport` a `PlanView/View3D`-t `ErrorBoundary`-be csomagolja, így ha a WebGL
  context nem hozható létre, csak a nézet helyén jelenik meg hibaüzenet (a sidebar/UI marad).

## 11. Állapot és tárolás

### 11.1 `store/projectStore.ts`
zustand store. Fő mezők: `project`, `viewMode`, `planTool`, `draftRoom`, kijelölések
(`selectedBoxId/SurfaceId`, `editingSurfaceId`, `selectedSubRegionId`, `selectedCells`), `past/future` (undo).
- **`mutate(fn)`**: minden projekt-módosítás ezen megy át → history push (max 50) + debounce-olt autosave (400 ms).
- **`surfaces()`**: származtatott felületek + a `surfaceData` subRegion-jei.
- **Húzás-koalescálás:** `beginDrag()` egyszer pillanatképet ment és bekapcsolja a modul-szintű
  `suppressHistory`-t; közben a `mutate` NEM rak history-ba; `endDrag()` kikapcsolja. → folyamatos húzás =
  egy undo-lépés (doboz-mozgatás, alterület move/resize, csúcspont-húzás).
- **Rajzolás/szerkesztés akciók:** `draftHeightCm`, `updateDraftPoint`, `commitDraftRoom`,
  `moveRoomVertex`, `insertRoomVertex`, `deleteRoomVertex` (≥3 pont), `updateSubRegionPolygon`,
  `move/insert/deleteSubRegionVertex`.
- **Dev hook:** `import.meta.env.DEV` esetén `window.store = useStore` (böngészős teszthez; produkcióból kimarad).

### 11.2 `db/storage.ts` (IndexedDB, `idb`)
Két store: `projects` (JSON, url-ek nélkül — `stripUrls`) és `images` (Blob, key=imageId).
`hydrateImageUrls(project)` betöltés után object URL-eket gyárt a blobokból. Az aktuális projekt id-je `"default"`.

**Export/Import (minden, a textúrákkal):** `exportProjectBlob(project)` egyetlen JSON-blobot ad
(`{format:'tilesim', version, project (url nélkül), images: {id:{name,type,data(base64)}}}`) — a képeket
az IndexedDB-ből base64-be kódolja. `importProjectFile(file)` visszaírja a képeket az IndexedDB-be és
visszaadja a projektet. A store `exportProject()` letölti a `<név>.tilesim.json`-t, az `importProject(file)`
migrál (`migrateProject`), `id="default"`-ra állít, ment, hidratál és lecseréli az aktuális projektet.
UI: „⭳ Export" / „⭱ Import" gomb a toolbarban (rejtett file-input). A `migrateProject` helper a betöltésnél
és importnál is fut (mezők pótlása, régi `rect`→poligon).

## 12. Megoldott buktatók (gotchas) — MIÉRT

1. **Plan kamera 45°-os elfordulása:** lefelé néző ortografikus kameránál az up-vektor degenerált →
   `up=[0,0,-1]`-re állítva (PlanView).
2. **Falak átlátszatlansága kintről:** `DoubleSide` esetén a közeli fal eltakarta a szobát → a falak
   egyoldalasak (`FrontSide/BackSide` a `frontFacesDesired` szerint).
3. **Doboz teteje/alja elforgatva:** `(uAxis,vAxis,normal)` balkezes volt a top/bottom lapnál → tükrözés →
   hibás kvaternió. Megoldás: a póz **mindig** `nGeo=u×v` jobbkezes bázist használ (`pose.ts`).
4. **Doboz minden oldala látszódjon:** a dobozoldalak `DoubleSide`-ot kapnak (a falak nem).
5. **Kamera pásztázott doboz-húzás közben:** húzás idejére `controls.enabled=false` (BoxGroup).
6. **Textúra-orientáció:** `CanvasTexture.flipY=false` + a canvas „v lefelé" rajzolása konzisztens a
   PlaneGeometry/Floor UV-vel (a **régiók pozíciója** helyes a 3D-ben és a szerkesztőben is). **DE:** a fal (és
   függőleges doboz-oldal) `vAxis`-a FELFELÉ mutat (v=0=padló), a vászon viszont v-lefelé rajzol, így a
   `drawImage` a KÉP tetejét a padló felé tenné → a fal-képek fejjel lefelé lennének (szimmetrikus csempénél
   nem látszik, egy ajtó-képnél igen). Ezért a `renderSurfaceCanvas` a **kép tartalmát** függőlegesen tükrözi
   ott, ahol `surface.transform.vAxis.y > 0.5` (`flipImg`), a régiók pozícióját NEM. A szerkesztő `flipV`-je
   ugyanezt a vásznat mutatja (a fal alját lentre), így 3D és szerkesztő végig egyezik. Fontos: NEM `flipY`-nal
   javítjuk, mert az az egész felületet (a régiók helyét is) tükrözné → a csempesávok elcsúsznának a szerkesztőhöz képest.
7. **R3F szintetikus események tesztben:** a kézzel kreált pointer/MouseEvent-nek kell `view: window`,
   különben az R3F raycast nem fut le (lásd 13).
8. **`import.meta.env` build hiba:** `src/vite-env.d.ts`-ben `/// <reference types="vite/client" />`.
9. **Él dupla-katt vékony mesh-en megbízhatatlan:** a vékony „él-doboz" raycastja gyakran mellément →
   az új-csúcspont beszúrást a `FloorMesh.onDoubleClick` (nagy találati felület) végzi `nearestEdge`-dzsel.
   (Szintetikus `dblclick` teszthez kell előtte klikk-szekvencia, mert az R3F a click-állapotból dolgozik.)
10. **Drag a hit-routing helyett window-listenerrel:** a csúcspont/rajzpont húzását `window`
    `pointermove/pointerup` kezeli + saját `screenToCm` raycast — mert az R3F hit-routing elveszti a célt,
    ha a kurzor lecsúszik az objektumról (RoomEditingLayer).
11. **Modul-szintű `suppressHistory`:** a `beginDrag/endDrag` egy modul-változót billent, NEM store-mezőt
    (a `mutate` szinkron olvassa); így a húzás közbeni sok `set` egyetlen undo-lépés marad.
12. **WebGL context kimerülés / fehér képernyő:** sok HMR-reload után a böngésző blokkolhatja az új WebGL
    contextet → a `Canvas` dob. Az `ErrorBoundary` (App.viewport) elkapja, így csak a nézet hibázik, az app
    nem. (Dev tipp: ha tesztben „context loss and was blocked" jön, indíts friss preview-böngészőt.)
13. **Fal-szerkesztő v-iránya:** a falaknál `v=0` a padló (vAxis felfelé), de a szerkesztő canvasa lefelé
    rajzol → enélkül a „lent" kijelölés a fal tetejére esne. Megoldás: `flipV` a vertikális-vAxis felületekre
    (lásd 10). A 3D leképzés helyes volt, csak a szerkesztő megjelenítése tükröződött az intuícióhoz.
14. **Debounce-olt autosave pillanatkép:** a `scheduleSave` korábban a mutáció `next` pillanatképét mentette
    400 ms késéssel. Ha közben más felülírta a projektet (pl. `importProject`), a késleltetett mentés a RÉGI
    állapotot írta vissza. Megoldás: a `scheduleSave` fire-kor `get().project`-et ment (mindig a legfrissebbet).
15. **Fényesség csak környezettel látszik:** a `roughnessMap` önmagában (env nélkül) alig ad fényes hatást
    (csak parányi direkt-fény csúcsfény). A `View3D` `<Environment>`-je (Lightformer-ek) adja a tükröződést,
    így a fényes csempék láthatóan csillognak. (A `MeshStandardMaterial` auto. használja a `scene.environment`-et.)
16. **drei `<Html>` címkék a popupok fölött:** a plan-nézeti falhossz-címkék (`<Html>`) nagyon magas
    z-indexet kapnak (~16M). Ha a `.viewport` nem hoz létre stacking contextet, ez a gyökér szintjén a fixed
    modálisok (z-index 50) fölé kerül. Megoldás: `.viewport { isolation: isolate }` — a címkék a viewport
    stacking contextjébe záródnak, így a popupok föléjük kerülnek.

## 13. Tesztelés és böngészős verifikáció

- **Unit teszt:** `npm test` — a generátorok hézag-/átfedésmentességét mintavételezéssel ellenőrzi
  (`patterns.test.ts`). Új tiszta függvényt (geometria, pattern) érdemes tesztelni.
- **Böngészős verifikáció (Claude Preview MCP):** a dev `window.store`-on át lehet állapotot állítani
  (`window.store.getState().addRoom(...)` stb.) és képernyőképet készíteni.
- **R3F interakció szimulálása evalból:** a `dispatchEvent`-hez **kötelező** a `view: window` és a teljes
  pointer-szekvencia (`pointermove → pointerdown → pointerup [→ click]`), különben nem fut az R3F handler.
  A `preview_click` (CDP) koordinátái a screenshot-skálázás miatt nem mindig találnak a WebGL canvasra —
  ortografikus kameránál a világ→képernyő vetítés kézzel számolható (`1 world = zoom px`).

## 14. Ismert korlátok / jövőbeli munka
- Komplex minták (Versailles, francia, vegyes méretű modul) — a motor készen áll rá (6.4).
- Projekt export/import fájlba, több projekt kezelése (jelenleg 1 „default" projekt).
- Nyílászárók (ajtó/ablak kivágás a falból), görbe falak, lejtős mennyezet.
- PBR anyagok (normal/roughness map), mennyiség-kalkuláció (m² / hulladék%).
- **Forgatás és cella-felülírások:** az `angleDeg` változtatása ÚJ cella-rácsot generál (más
  `cellId`-k), ezért a meglévő `tileOverrides` nem feleltethető meg → forgatás után a korábbi
  egyedi csempe-hozzárendelések „eltűnnek". Ajánlott munkamenet: előbb minta + forgatás beállítása,
  utána cella-szintű hozzárendelés. Stabil cella-identitás forgatás alatt = jövőbeli feladat
  (a generátoroknak negatív index-tartományt és rögzített fázist kellene támogatniuk).

## 14.5 Hosting / Deploy (GitHub Pages)
Az app **tisztán kliensoldali** statikus SPA (nincs backend; IndexedDB tárolás), így statikus hoszting elég.
- **Cím:** https://gaaaron.github.io/TileSim/ (projekt-oldal).
- **`base`:** `vite.config.ts`-ben production alatt `/TileSim/` (dev alatt `/`, hogy a `npm run dev` a gyökéren
  fusson). Projekt-oldalnál KÖTELEZŐ, különben az asset-útvonalak (`/assets/...`) 404-eznek.
- **Workflow:** `.github/workflows/deploy.yml` — `master`-re push (vagy kézi `workflow_dispatch`) → `npm ci` +
  `npm run build` → a `dist` feltöltése a Pages-re (`upload-pages-artifact` + `deploy-pages`).
- **Egyszeri kapcsoló:** repo → Settings → Pages → Source: **GitHub Actions**. A repónak **publikusnak** kell
  lennie (ingyenes csomagban). Nincs kliensoldali útvonal-routing → nincs SPA 404-átirányítás.

## 15. Dokumentációs szabály
**Minden fejlesztésnél frissítsd ezt a fájlt.** Ha új funkciót/komponenst adsz: bővítsd a fájltérképet (4),
az érintett szakaszt és szükség esetén a gotchas-t (12). Új buktató → mindig a MIÉRT-tel. A végén vezesd a
Changelog-ot. A dokumentáció magyarul készül; a kód-azonosítók angolul maradnak.

## 16. Changelog
- **2026-08-04** — **Fix: kis felületre nem lehetett alterületet rajzolni.** Az új alterület húzásának
  minimuma fix 3 cm volt mindkét irányban, ezért egy pl. 2 cm magas doboz-oldalra sose jött létre (`h>3`).
  Megoldás (`SurfaceEditor.onUp`): a minimum a felület felére korlátozódik — `min(3, dim/2)` —, így normál
  felületen marad a 3 cm (véletlen kattintás kiszűrése), kis felületen viszont teljes-oldalas húzással működik.
- **2026-08-04** — **Szín = egy undo-lépés + kevesebb lassulás.** A színválasztó folyamatos `onChange`-e eddig
  minden apró változásnál külön undo-elemet rakott be és `structuredClone`-ozott (lassulás). Új `useColorCommit`
  hook: az első változásnál `beginDrag` (egy pillanatkép), a többit elnyomja, `onBlur`-nél `endDrag` — így egy
  keverés EGY undo-lépés; ráadásul `requestAnimationFrame`-mel frame-enként egyszer megy a store-ba (kevesebb
  újrarajzolás). Használja a `ColorField` és a `FavoriteColorsManager` sorai (`FavoriteRow`). A `SurfaceEditor`
  vászon-rajzolása is rAF-ritkított (alterület-húzás simább). A dobozok/objektumok/szoba-csúcsok/alterületek
  húzása már eddig is EGY undo-lépés volt (`beginDrag`/`endDrag`) — ez változatlan.
- **2026-08-04** — **Kedvenc színek (elnevezett).** `project.favoriteColors` ({id,name,color}) a projektben
  mentve (export/import, undo). Kompakt **`ColorField`** minden színválasztónál: natív input + EGYETLEN ★ ikon,
  ami a `FavoriteColorsManager` popupot nyitja — ott történik a jelenlegi szín mentése ÉS a kiválasztás
  (a hívó mezőre alkalmazva a `favoritePicker={color,onPick}` célponton át), plusz név/szín szerk. és törlés.
  Használat: SurfaceEditor, RoomEditor, TileInspector (szín+fuga), TileLibraryPanel (fuga).
- **2026-08-04** — **GitHub Pages deploy.** `vite.config.ts` `base=/TileSim/` (prod), `.github/workflows/
  deploy.yml` (build → Pages). Cím: https://gaaaron.github.io/TileSim/. Lásd 14.5.
- **2026-08-04** — **Szoba magasság a szoba-szerkesztőben.** A `RoomEditor` popup kapott egy „Magasság (cm)"
  mezőt (`updateRoom({heightCm})`, Enter/blur alkalmaz). A falak és a mennyezet a származtatott geometriában
  automatikusan követik. Az alterületek a felület (u,v) terében a padlótól méretezettek (v=0 = padló), ezért
  magasságváltozáskor a szoba aljához képest ugyanott maradnak – nincs velük külön teendő.
- **2026-08-04** — **Fix: fal-KÉP (pl. ajtó) fejjel lefelé.** A vászon v-lefelé rajzol, a fal `vAxis`-a
  felfelé mutat → a `drawImage` a kép tetejét a padló felé tette. Megoldás: a `renderSurfaceCanvas` a
  **kép tartalmát** függőlegesen tükrözi függőleges felületeknél (`vAxis.y>0.5`), a régiók pozícióját nem.
  (Első próbálkozás `flipY=true` volt, de az az egész felületet tükrözte → a csempesávok elcsúsztak a
  szerkesztőhöz képest; visszavonva.) Lásd a 6. gotchát.
- **2026-08-04** — **Fix: mennyezet irreálisan szürke volt 3D-ben.** A lefelé néző mennyezetet felülről nem
  éri fény, ezért a fehér is szürkére sötétedett; cél, hogy azonos alapszínnél a mennyezet és a falak
  hasonlóak legyenek. Megoldás: (1) irány-független világítás erősítése — `ambient 0.4→0.55`, hemisphere
  talaj-szín `#444455→#6d6d78` (a mennyezet ezt a teljes színt kapja); (2) kis emissive-kompenzáció a
  mennyezeten (`emissive=#fff, emissiveMap=map, emissiveIntensity=0.15`) a hiányzó directional pótlására.
- **2026-08-04** — **Mennyezet (mennyezet-oldal):** a szobáknak mostantól mennyezet-felületük is van.
  `SurfaceKind += 'ceiling'`; `ceilingSurface(room)` a `geometry.ts`-ben (mint a padló, de `y=heightCm`,
  `normal=-Y`, id `:ceiling`, saját alapszín `#eceae4`); az `allSurfaces` sorrendje: padló, mennyezet, falak.
  A `FloorMesh` kapott egy `ceiling` propot (magasságban rajzol, `FrontSide` — belülről látszik, felülről nem
  takarja a 3D nézetet, nincs él-beszúrás). A `SceneContents` csak 3D-ben rendereli a mennyezetet. A mennyezet
  megjelenik az Oldalak panelen (külön szerkeszthető/rejthető/színezhető), és a `setRoomSurfacesBaseColor`
  csoportos szín is kiterjed rá.
- **2026-06-26** — **Fix:** a plan-nézeti falhossz-címkék (drei `<Html>`) a popupok/modálisok FÖLÉ kerültek a
  magas z-indexük miatt. Javítás: `.viewport { isolation: isolate }` — a címkék a viewport stacking
  contextjébe záródnak, így a popup takarja őket (16. gotcha).
- **2026-06-26** — **Oldal-alapszín + szoba-szerkesztő:** `project.surfaceBaseColor` felülírja egy felület
  alapszínét (`surfaces()` alkalmazza, a `useSurfaceTexture` sig-je is figyeli). Egyedi színválasztó a
  `SurfaceEditor` fejlécében (`setSurfaceBaseColor`). A `RoomsPanel` sorára (dupla)kattintva megnyílik a
  `RoomEditor` popup: név, X-Y pozíció (a poligon eltolása), és **csoportos** fal-alapszín az összes oldalra
  (`setRoomSurfacesBaseColor`).
- **2026-06-26** — **3D objektumok (GLB/glTF) elhelyezése:** `ModelAsset` + `SceneObject` típusok;
  `addModelAsset` (GLB feltöltés, natív befoglaló kiszámítása `loadModelBBox`-szal), `addObject/updateObject/
  removeObject`, `selectObject`. `ObjectGroup` (useGLTF, klónozás, skálázás), `ObjectsPanel` (feltöltés +
  „Elhelyez"), `ObjectInspector` (méret/pozíció/forgatás, mint a dobozé). Plan-húzás + szobához rendelés +
  szoba-láthatóság követése (mint a dobozok). Export/import a modell-blobokat is tartalmazza (three-stdlib függő).
- **2026-06-26** — Az alterület átméretezésének **minimum mérete 5 → 1 cm** (`resizeActiveSub` + a méret-mezők `min`).
- **2026-06-25** — Kezdeti MVP: csempe-könyvtár + IndexedDB, szoba (téglalap/poligon) + 3D származtatás,
  3D dobozok (húzás + inspector), felület-szerkesztő (alterület/minta/cella-hozzárendelés), grid/offset/
  herringbone generátorok, plan+3D nézet. Javítások: plan kamera up-vektor, fal egyoldalúság, doboz póz
  jobbkezes bázis + DoubleSide, kamera-lock doboz-húzáskor.
- **2026-06-25** — Minta-elforgatás (`PatternConfig.angleDeg`): a `subRegionTiles` középpont+forgatás alapú
  `CellTile`-t ad, a renderer és a szerkesztő forgatottan rajzol/talál; UI csúszka + 0/30/45/90° gombok;
  halszálka kiválasztásakor auto 45°. Ekkor jött létre ez a `DEVELOPMENT.md` és a dokumentációs szabály.
- **2026-06-25** — Alterület **mozgatás + átméretezés** a felület-szerkesztőben (8 fogantyú, `updateSubRegionRect`
  — később a poligon-alterület váltotta fel, lásd lentebb),
  + `beginDrag/endDrag` húzás-koalescálás (alterület és doboz egy undo-lépés / húzás).
- **2026-06-25** — Alaprajzi **szoba-rajzolás újragondolva** (`RoomEditingLayer`): húzd-a-falat élő előnézet +
  felengedésre rögzítés, falhossz-címkék, **Shift** = 45°-os kiegyenesítés, kezdőpontra kattintva záródás;
  meglévő szoba **csúcspontjai mozgathatók**, él **dupla-kattintásra új pont** (`FloorMesh`), csúcsponton
  kattintva **context menu „Pont törlése"**. Új store-akciók + `nearestEdge` geometria-helper.
- **2026-06-25** — **Felület-láthatóság + összecsukható oldalpanel:** `project.surfaceHidden`,
  `setSurfaceHidden/toggleSurfaceHidden`, a `SceneContents` kihagyja a rejtett felületeket; új
  `CollapsibleGroup` akkordeonok (Szobák/Oldalak/Csempék), `SurfacesPanel` (felület-lista checkboxszal +
  sorra katt = szerkesztő), „Látható" checkbox a `SurfaceEditor` fejlécében. Új `ErrorBoundary` a nézet köré.
- **2026-06-25** — **Alterület = poligon + felület valódi alakja a szerkesztőben:** `SubRegion.rect` →
  `polygon: Vec2[]` (migrációval); `Surface.outline` (pl. L-padló) elsötétítve a szerkesztőben; a render a
  poligonra klippel. Az alterület szerkesztése az alaprajzihoz hasonló: csúcs-mozgatás, él-dupla-katt = új
  pont, csúcs-context-menu = törlés, belül-húzás = mozgatás. Új store-akciók
  (`updateSubRegionPolygon`, `move/insert/deleteSubRegionVertex`) + `pointInPolygon` helper.
- **2026-06-26** — **Per-cella textúra-kiosztás:** `SubRegion.imageOverrides` (cellId → kép-index),
  `tilePicker.imageIndexFor`/`pickImageUrl` override-paraméter, `setCellImageOverrides` store-akció.
  A szerkesztőben „Textúra léptetése" (kijelölt cellák kép-indexének léptetése, ha a csempének >1 képe van)
  és globális „Véletlen kiosztás" (az alterület összes cellájára véletlen textúra) gomb.
- **2026-06-26** — **Anyagszükséglet panel** (`MaterialPanel`, alapból csukott `CollapsibleGroup` → csak
  nyitva számol): csempénként db + m² (cella középpontja a poligonban = 1 db, a vágott is; m² = db × csempeterület).
- **2026-06-26** — **Csempe sima szín + fényesség:** `TileType.color` (kép híján ezzel renderel) és
  `glossiness` (0..1). A renderer érdesség-térképet is gyárt (`roughnessCanvas`), a `useSurfaceTexture`
  `{map, roughnessMap}`-et ad, a 3D anyagok `roughnessMap`-pel renderelnek. `TileInspector`: szín-választó +
  fényesség-csúszka; a kártyán szín-minta kép híján. **+ Fix:** a `View3D` procedurális `<Environment>`-je
  (Lightformer-ek) adja a tükröződést, hogy a fényesség 3D-ben látható legyen (enélkül „nem fényes").
- **2026-06-26** — **Alterület numerikus átméretezése + pivot:** „Méret (cm)" szakasz 3×3 pivot-ráccsal és
  W/H mezőkkel; a `resizeActiveSub` a poligont a választott pivot (sarok/oldalfelező/középpont) körül skálázza.
  + **Numerikus pozíció** (X/Y mezők, `moveActiveSubTo`): az alterületet a megadott bal-felső sarokra tolja.
- **2026-06-26** — **Dobozok szobához rendelve + követik a láthatóságot:** `Box.roomId` (pozíció alapján,
  `roomForPoint`); `addBox`/`updateBox` beállítja, migráció backfilleli; a `SceneContents` kihagyja a rejtett
  szobájú dobozt → szoba elrejtésekor a dobozai is eltűnnek.
- **2026-06-26** — **Alterület él-hosszok + Shift-derékszög:** az aktív alterület éleinek hossza látszik a
  szerkesztőben (mint a falhosszok); csúcs-húzásnál Shift → `snapRightAngle` (a csúcs a szomszédaihoz igazodik
  derékszögűre). **Bugfix:** a debounce-olt autosave mostantól a LEGFRISSEBB projektet menti (`scheduleSave`
  `get().project`-et olvas fire-kor), nem egy elavult pillanatképet — különben egy késleltetett mentés
  felülírhatott pl. egy importot.
- **2026-06-26** — **Export/Import (mindennel, a textúrákkal):** `exportProjectBlob`/`importProjectFile`
  (storage), `exportProject`/`importProject` store-akciók, „⭳ Export"/„⭱ Import" toolbar-gombok. A teljes
  projekt + képek egyetlen `.tilesim.json`-ban (base64 textúrák). A migráció kiemelve `migrateProject`-be.
- **2026-06-26** — **Csempetípus szerkesztése** (`TileInspector` popup): a kártya fejlécére kattintva
  módosítható a csempe neve, mérete (cm) és fugája (`updateTileType`); a méretváltozás élőben hat a mintákra.
- **2026-06-26** — **Csempe 90°-os forgatása mintában (`PatternConfig.tileRotated`)** + checkbox a
  szerkesztőben: a `subRegionTiles` felcseréli a csempe w/h-t, a renderer a képet is forgatja. **Szoba-
  láthatóság** (`project.roomHidden`, `set/toggleRoomHidden`): a `SceneContents`/`RoomEditingLayer` kihagyja
  a rejtett szobát; checkbox a `RoomsPanel` sorában.
- **2026-06-26** — **Halszálka cella-méret = csempe-méret:** korábban a rövid oldalt `hosszú/2`-re
  kényszerítettük (40×60 csempe → 60×30 cella). Mostantól `W=min(w,h)` → a cellák a csempe valódi méretét
  veszik (40×60 → 40×60). 2:1 csempénél hézagmentes; más aránynál kis hézag/átfedés (geometriai korlát).
- **2026-06-26** — **Fal-szerkesztő függőleges tükrözés (`flipV`):** falaknál `v=0` a padló, de a szerkesztő
  korábban a vászon TETEJÉRE rajzolta — a „lent" kijelölés a fal tetejét érintette. Mostantól a vertikális-
  `vAxis`-ú felületeknél a megjelenítés+egér-leképzés tükröződik (`vy`, `toXY`, alap-textúra `scale(1,-1)`,
  cella-szög negálás), így a vászon alja = a fal alja.
