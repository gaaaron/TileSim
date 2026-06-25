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
  tilePicker.ts     # több kép közül determinisztikus választás (cellId hash)
  imageCache.ts     # kép betöltés + useImages() React hook
three/
  pose.ts            # surfacePose(): felület → 3D pozíció + kvaternió (JOBBKEZES bázis!)
  useSurfaceTexture.ts # Surface → élő THREE.CanvasTexture (memoizált)
  SurfacePlane.tsx   # fal / doboz-oldal mint textúrázott plane (Front/Back/DoubleSide)
  FloorMesh.tsx      # tetszőleges padló-poligon háromszögelve, textúrázva
  BoxGroup.tsx       # doboz 6 oldala + plan-nézeti húzás (+ kamera-lock húzás közben)
  SceneContents.tsx  # a megosztott 3D tartalom (padlók, falak, dobozok)
views/
  PlanView.tsx       # alaprajz: ortografikus felülnézet, szoba-rajzolás
  View3D.tsx         # 3D: perspektív + OrbitControls + fények
  SurfaceEditor.tsx  # MODAL oldal-szerkesztő (alterület, minta, forgatás, cellák)
panels/
  RoomsPanel.tsx     # téglalap-szoba gyorslétrehozás + szoba-lista
  TileLibraryPanel.tsx # csempetípusok + képfeltöltés + fuga
  BoxInspector.tsx   # kijelölt doboz méret/pozíció popup
store/projectStore.ts # zustand store (állapot + akciók + undo/redo + autosave)
db/storage.ts         # IndexedDB: projekt + kép-blobok, hydrateImageUrls()
App.tsx, main.tsx, styles.css, vite-env.d.ts
```

## 5. Adatmodell (`model/types.ts`)

- **`TileType`**: `{ id, name, widthCm, heightCm, images: ImageRef[], groutMm, groutColor }`.
  Egy típushoz több kép is tartozhat → vegyes lerakás.
- **`ImageRef`**: `{ id, name, url? }`. A blob az IndexedDB-ben él; az `url` futásidejű object URL
  (nem perzisztált; betöltéskor `hydrateImageUrls` állítja elő).
- **`Room`**: `{ id, name, floorPolygon: Vec2[] (cm, XZ), heightCm }`.
- **`Box`**: `{ id, name, pos:{x,y,z}, size:{w,h,d}, rotationY }`. `pos.x/z` = vízszintes hely,
  `pos.y` = a doboz **aljának** magassága; a doboz közepe `(pos.x, pos.y+h/2, pos.z)`.
- **`Surface`** (származtatott geometria, lásd 6.1): `{ id, kind:'floor'|'wall'|'box-face', label,
  widthCm, heightCm, transform: SurfaceTransform, subRegions: SubRegion[], baseColor }`.
- **`SurfaceTransform`**: `{ origin, uAxis, vAxis, normal }` (origin világ-méterben, a tengelyek egységvektorok).
- **`SubRegion`**: `{ id, rect:{u,v,w,h} (cm a felület terében), pattern: PatternConfig,
  tileOverrides: Record<cellId, tileTypeId> }`.
- **`PatternConfig`**: `{ generator:'grid'|'offset'|'herringbone', defaultTileTypeId, angleDeg,
  originOffset:{x,y}, params: Record<string,number> }`.
- **`Project`**: `{ id, name, tileTypes[], rooms[], boxes[], surfaceData: Record<surfaceId, SubRegion[]> }`.
  **Fontos:** a felületek geometriája NINCS tárolva — a szobákból/dobozokból **származtatott**
  (lásd 6.1). Csak a felülethez tartozó `subRegions` perzisztálódik `surfaceData[surfaceId]` alatt.

## 6. Geometria és pattern-motor

### 6.1 Felület-származtatás (`model/geometry.ts`)
- `floorSurface(room)`: padló-felület; `(u,v)` a poligon befoglaló téglalapja; `uAxis=+X, vAxis=+Z, normal=+Y`.
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
- **`herringbone`**: 90°-os halszálka. A tökéletes illeszkedéshez a **rövid oldal = hosszú/2**.
  Motívum: `H=(0,0,L,W)` + `V=(L,0,W,L)`. Rács-vektorok `v1=(W,L+W), v2=(W,-W)` — ezek
  hézag-/átfedésmentesen töltik a síkot (det = 2·L·W = a motívum területe, L=2W mellett).
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
a felület `(u,v)` terében (cm). Lépések:
1. Az alapcsempe mérete a `defaultTileTypeId`-ból (fallback 40×40).
2. Ha `angleDeg ≈ 0`: a generátort a rect méretére hívjuk, a rect-et metsző cellákat tartjuk, és
   sarok→középpont konverzió.
3. Ha `angleDeg ≠ 0`: nagyobb területre generálunk (`rect + 2*margin`, `margin=átló`), majd minden
   csempe-középpontot a **rect közepe körül** elforgatunk `angleDeg`-gel; a rect-en kívüli cellákat eldobjuk.
   A cella `rotationDeg = angleDeg`.

`renderSurfaceCanvas(surface, tileTypes, images)`:
- Canvas mérete `widthCm*ppc × heightCm*ppc` (`ppc` = pixel/cm, max ~2048 px-re skálázva).
- Felületenként/alterületenként: klippelés a rect-re, fuga-háttér kitöltés, majd minden cellára:
  `translate(cx,cy) → rotate(rotationDeg) → drawImage középre igazítva, grout/2 behúzással`.
  Kép hiányában tömör szín.
- Visszaad `{canvas, ppc}`. Hívó `THREE.CanvasTexture`-be csomagolja (`flipY=false`, sRGB).

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
`(x*cm, 0, z*cm)`-re teszi, a UV-t a befoglaló téglalapra normálja (`(x-minX)/w, (z-minZ)/h`).
`DoubleSide`. Klikk/duplaklikk = felület kijelölés/szerkesztés.

### 8.5 `BoxGroup.tsx`
A doboz 6 `SurfacePlane` oldala egy `<group>`-ban. **Plan nézetben húzható:** `pointerdown`→`pointerup`
a földsíkra (`y=0`) raycastol, és frissíti `box.pos.x/z`-t. **Kamera-lock (gotcha):** húzás kezdetén
`controls.enabled=false` (a `useThree(s=>s.controls)`-ból), `pointerup`-nál vissza `true` — különben a
`MapControls` is pásztázna a húzással. Kijelölt dobozhoz `BoxOutline` drótváz.

### 8.6 `SceneContents.tsx`
A megosztott tartalom (mindkét nézet használja, `mode:'plan'|'3d'` prop). Szobánként `FloorMesh` + falak
(`SurfacePlane`, csak 3D-ben), dobozonként `BoxGroup`. Egy láthatatlan földsík `onClick`-je törli a kijelölést.

## 9. Nézetek

### 9.1 `PlanView.tsx` (alaprajz)
`<Canvas>` + `OrthographicCamera` fentről (`position=[2,50,2]`, **`up=[0,0,-1]`** — különben a lefelé néző
kamera up-vektora degenerált és 45°-kal elfordulna a kép!), `zoom=120` (1 world = 120 px). `MapControls`
`enableRotate={false}` (csak pan+zoom). Szoba-rajzolás módban egy láthatatlan sík `onClick`-je adja a
pontokat (cm-re kerekítve); a vázlat-poligon `drei <Line>` + gömbök.

### 9.2 `View3D.tsx`
Perspektív kamera + `OrbitControls` + `ambient/hemisphere/directional` fények.

## 10. Felület-szerkesztő (`views/SurfaceEditor.tsx`)
Modal. A felületet kiterítve egy `<canvas>`-ra rajzolja (`renderSurfaceCanvas` → `drawImage` skálázva),
fölé az alterület-kereteket, a cella-rácsot és a kijelölést. Két mód:
- **`region`**: téglalap húzása → `addSubRegion`.
- **`cells`**: klikk = egy cella toggle, húzás = gumikeret (a cella **középpontja** alapján).
  A cellák **elforgatottak** lehetnek (`rotationDeg`), ezért a találat-vizsgálat a pontot a cella lokális
  keretébe transzformálja (`-rotationDeg` forgatás, majd `|lx|≤w/2 && |ly|≤h/2`).
A minta-vezérlők: generátor választó (halszálkánál auto 45°), alap csempe, **Elforgatás csúszka + 0/30/45/90°
gombok** (`angleDeg`), generátor-paraméterek (`paramSpec`), `originOffset`. Cella-kijelöléshez csempe-hozzárendelés.

## 11. Állapot és tárolás

### 11.1 `store/projectStore.ts`
zustand store. Fő mezők: `project`, `viewMode`, `planTool`, `draftRoom`, kijelölések
(`selectedBoxId/SurfaceId`, `editingSurfaceId`, `selectedSubRegionId`, `selectedCells`), `past/future` (undo).
- **`mutate(fn)`**: minden projekt-módosítás ezen megy át → history push (max 50) + debounce-olt autosave (400 ms).
- **`surfaces()`**: származtatott felületek + a `surfaceData` subRegion-jei.
- **Dev hook:** `import.meta.env.DEV` esetén `window.store = useStore` (böngészős teszthez; produkcióból kimarad).

### 11.2 `db/storage.ts` (IndexedDB, `idb`)
Két store: `projects` (JSON, url-ek nélkül — `stripUrls`) és `images` (Blob, key=imageId).
`hydrateImageUrls(project)` betöltés után object URL-eket gyárt a blobokból. Az aktuális projekt id-je `"default"`.

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
   PlaneGeometry/Floor UV-vel.
7. **R3F szintetikus események tesztben:** a kézzel kreált pointer/MouseEvent-nek kell `view: window`,
   különben az R3F raycast nem fut le (lásd 13).
8. **`import.meta.env` build hiba:** `src/vite-env.d.ts`-ben `/// <reference types="vite/client" />`.

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

## 15. Dokumentációs szabály
**Minden fejlesztésnél frissítsd ezt a fájlt.** Ha új funkciót/komponenst adsz: bővítsd a fájltérképet (4),
az érintett szakaszt és szükség esetén a gotchas-t (12). Új buktató → mindig a MIÉRT-tel. A végén vezesd a
Changelog-ot. A dokumentáció magyarul készül; a kód-azonosítók angolul maradnak.

## 16. Changelog
- **2026-06-25** — Kezdeti MVP: csempe-könyvtár + IndexedDB, szoba (téglalap/poligon) + 3D származtatás,
  3D dobozok (húzás + inspector), felület-szerkesztő (alterület/minta/cella-hozzárendelés), grid/offset/
  herringbone generátorok, plan+3D nézet. Javítások: plan kamera up-vektor, fal egyoldalúság, doboz póz
  jobbkezes bázis + DoubleSide, kamera-lock doboz-húzáskor.
- **2026-06-25** — Minta-elforgatás (`PatternConfig.angleDeg`): a `subRegionTiles` középpont+forgatás alapú
  `CellTile`-t ad, a renderer és a szerkesztő forgatottan rajzol/talál; UI csúszka + 0/30/45/90° gombok;
  halszálka kiválasztásakor auto 45°. Ekkor jött létre ez a `DEVELOPMENT.md` és a dokumentációs szabály.
