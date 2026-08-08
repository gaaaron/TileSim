# Tile Layout Simulator (TileSim)

**Language / Nyelv:** [English](#english) · [Magyar](#magyar)

> This README is bilingual. The two sections mirror each other — **when you change one, change the other in sync.**
> Ez a README kétnyelvű. A két szakasz egymás tükre — **ha az egyiket módosítod, a másikat is módosítsd vele szinkronban.**

---

## English

Web app for planning tiling in real-scale 3D spaces. You define tile types (size + images or a
plain color), draw rooms, place 3D boxes and imported 3D models, then edit tile patterns per
surface on walls, floor, ceiling and box faces with an extensible pattern engine.

**Live demo:** https://gaaaron.github.io/TileSim/

### Tech stack
- **Vite + React + TypeScript**
- **three.js + @react-three/fiber + @react-three/drei** — 3D rendering
- **zustand** — state + undo/redo
- **IndexedDB (idb)** — local storage of projects and image blobs (autosave)

All sizes are in **centimeters**; the 3D scene works in meters (1 cm = 0.01 world unit).

> **For developers:** the full architecture write-up (data model, render pipeline, gotchas,
> extension recipes, changelog) is in [DEVELOPMENT.md](DEVELOPMENT.md). **Rule: extend it on every change.**

### Getting started
```bash
npm install
npm run dev      # dev server (http://localhost:5173)
npm run build    # production build
npm test         # unit tests (pattern generators)
```
On Windows you can also run `start-szerver.cmd` to launch the dev server.

### Features
- **Tile types**: name, size (e.g. 40×60 cm), multiple uploaded images (mixed laying) or a plain
  color, glossiness, grout width/color.
- **Rooms**: quick fixed-size rectangle or free polygon drawing on the floor plan; height →
  floor, walls and **ceiling** are derived automatically. Room editor: name, X/Y position, height,
  group base color.
- **3D boxes** and **3D objects (GLB/glTF)**: add, drag on the floor plan, size/position/rotation in a popup.
- **Two views**: floor plan (top-down, orthographic) and 3D (perspective, OrbitControls) — the
  **same scene**, so textures render in every view.
- **Surface editor**: on the flattened 2D view of a surface you draw subregions, pick a pattern
  (symmetric grid / offset bond / herringbone), then select cells and assign tile types. Per-surface
  base color.
- **Favorite colors**: named, saved with the project, selectable at every color picker.
- **Materials**: per tile type, needed piece count and m².
- **Export/Import**: whole project to a single JSON file (textures included).
- **Bilingual UI (Hungarian/English)**: auto-detected from the browser/system language, switchable in the toolbar.

### Architecture (main folders, `src/`)
- `model/` — pure types (`types.ts`) and geometry (`geometry.ts`: polygon→walls, floor/ceiling,
  box faces, surface→world transform).
- `patterns/` — **extensible pattern engine**: shared `PatternGenerator` interface (`types.ts`),
  `grid` / `offset` / `herringbone` generators, `registry.ts`. A new pattern = new file + registration.
- `render/` — `SurfaceTexture.ts`: subregions + pattern are drawn to an offscreen canvas (with grout,
  image assignment) → `THREE.CanvasTexture`.
- `three/` — scene components (`SceneContents`, `FloorMesh`, `SurfacePlane`, `BoxGroup`, `ObjectGroup`)
  + `useSurfaceTexture` hook and `pose.ts` (surface→3D placement).
- `views/` — `PlanView`, `View3D`, `SurfaceEditor`.
- `panels/` — `RoomsPanel`, `TileLibraryPanel`, inspectors, `MaterialPanel`, `ObjectsPanel`, `FavoriteColorsManager`.
- `store/projectStore.ts` — zustand store, undo/redo, autosave.
- `i18n/i18n.ts` — localization (hu/en) dictionary + detection + `useT()`.

### Pattern engine
`PatternGenerator.generate(bounds, ctx)` returns **abutting** tiles (without grout); the renderer
adds the grout gap (drawing each tile inset by grout/2), so grout is handled uniformly for every
pattern. Herringbone is gap/overlap-free via derived grid vectors. The generators are covered by
unit tests (`patterns.test.ts`).

### Deployment
Hosted on **GitHub Pages** via `.github/workflows/deploy.yml` (build on push to `master`). Vite `base`
is `/TileSim/` in production.

### Future work
- Complex patterns (Versailles, French, mixed-size module) — the engine is ready for them.
- Openings (door/window cutouts), curved walls, sloped ceilings.
- PBR materials (normal map), waste-percentage estimation.

---

## Magyar

Webes alkalmazás csempézés megtervezéséhez valós méretű 3D terekben. Csempetípusokat definiálsz
(méret + képek vagy sima szín), szobákat rajzolsz, 3D dobozokat és importált 3D modelleket helyezel
el, majd a falak, a padló, a mennyezet és a dobozok oldalaira oldalanként csempemintát szerkesztesz
egy bővíthető pattern-motorral.

**Élő demó:** https://gaaaron.github.io/TileSim/

### Technológia
- **Vite + React + TypeScript**
- **three.js + @react-three/fiber + @react-three/drei** — 3D render
- **zustand** — állapot + undo/redo
- **IndexedDB (idb)** — projektek és kép-blobok lokális tárolása (autosave)

Minden méret **centiméterben** értendő; a 3D scene méterben dolgozik (1 cm = 0.01 world unit).

> **Fejlesztőknek:** a teljes architektúra-leírás (adatmodell, render pipeline, gotchas, bővítési
> receptek, changelog) a [DEVELOPMENT.md](DEVELOPMENT.md)-ben. **Szabály: minden változásnál bővítsd.**

### Indítás
```bash
npm install
npm run dev      # fejlesztői szerver (http://localhost:5173)
npm run build    # produkciós build
npm test         # unit tesztek (pattern-generátorok)
```
Windowson a `start-szerver.cmd` is elindítja a fejlesztői szervert.

### Funkciók
- **Csempetípusok**: név, méret (pl. 40×60 cm), több feltöltött kép (vegyes lerakás) vagy sima szín,
  fényesség, fuga vastagság/szín.
- **Szoba**: pontos méretű téglalap gyorslétrehozás vagy szabad poligon rajzolás az alaprajzon;
  magasság → padló, falak és **mennyezet** automatikusan származnak. Szoba-szerkesztő: név, X/Y pozíció,
  magasság, csoportos alapszín.
- **3D dobozok** és **3D objektumok (GLB/glTF)**: hozzáadás, alaprajzon húzással mozgatás, popupban
  méret/pozíció/forgatás.
- **Két nézet**: alaprajz (felülnézet, ortografikus) és 3D (perspektív, OrbitControls) — **ugyanaz a
  scene**, így a textúrák minden nézetben renderelve látszanak.
- **Oldal-szerkesztő**: a felület kiterített 2D nézetében alterületeket rajzolsz, mintát választasz
  (szimmetrikus rács / kötésben eltolt / halszálka), majd cellákat jelölsz ki és csempetípust rendelsz
  hozzájuk. Oldalankénti alapszín.
- **Kedvenc színek**: elnevezve, a projekttel mentve, minden színválasztónál kiválasztható.
- **Anyagszükséglet**: csempénként a szükséges darabszám és m².
- **Export/Import**: a teljes projekt egyetlen JSON fájlba (a textúrákkal).
- **Kétnyelvű UI (magyar/angol)**: a böngésző/rendszer nyelvéből detektálva, a toolbarban váltható.

### Architektúra (fő mappák, `src/`)
- `model/` — tiszta típusok (`types.ts`) és geometria (`geometry.ts`: poligon→falak, padló/mennyezet,
  doboz-oldalak, felület→világ transzformáció).
- `patterns/` — **bővíthető pattern-motor**: közös `PatternGenerator` interfész (`types.ts`),
  `grid` / `offset` / `herringbone` generátorok, `registry.ts`. Új minta = új fájl + regisztráció.
- `render/` — `SurfaceTexture.ts`: a subRegion-ök + minta egy offscreen canvasra rajzolódnak (fugával,
  kép-kiosztással) → `THREE.CanvasTexture`.
- `three/` — scene-komponensek (`SceneContents`, `FloorMesh`, `SurfacePlane`, `BoxGroup`, `ObjectGroup`)
  + `useSurfaceTexture` hook és `pose.ts` (felület→3D elhelyezés).
- `views/` — `PlanView`, `View3D`, `SurfaceEditor`.
- `panels/` — `RoomsPanel`, `TileLibraryPanel`, inspectorok, `MaterialPanel`, `ObjectsPanel`, `FavoriteColorsManager`.
- `store/projectStore.ts` — zustand store, undo/redo, autosave.
- `i18n/i18n.ts` — többnyelvűség (hu/en) szótár + detektálás + `useT()`.

### Pattern-motor
A `PatternGenerator.generate(bounds, ctx)` **abutáló** csempéket ad (fuga nélkül); a fuga hézagot a
renderer teszi hozzá (minden csempét grout/2-vel beljebb rajzol), így a fuga egységesen kezelhető
minden mintára. A halszálka hézag-/átfedésmentes a derivált rács-vektorokkal. A generátorokat unit
teszt fedi (`patterns.test.ts`).

### Hosting / Deploy
**GitHub Pages** a `.github/workflows/deploy.yml`-lel (build a `master`-re pushkor). A Vite `base`
production alatt `/TileSim/`.

### Jövőbeli bővítések
- Komplex minták (Versailles, francia, vegyes méretű modul) — a motor készen áll rá.
- Nyílászárók (ajtó/ablak kivágás), görbe falak, lejtős mennyezet.
- PBR anyagok (normal map), mennyiség-kalkuláció (hulladék%).
