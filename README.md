# Csempe Elrendezés Szimulátor (TileSim)

Webes alkalmazás csempézés megtervezéséhez valós méretű 3D terekben. Csempetípusokat
definiálsz (méret + képek), szobákat rajzolsz, 3D dobozokat helyezel el, majd a falak,
a padló és a dobozok oldalaira oldalanként csempemintát szerkesztesz egy bővíthető
pattern-motorral.

## Technológia
- **Vite + React + TypeScript**
- **three.js + @react-three/fiber + @react-three/drei** — 3D render (kész motor)
- **zustand** — állapot + undo/redo
- **IndexedDB (idb)** — projektek és kép-blobok lokális tárolása (autosave)

Minden méret **centiméterben** értendő; a 3D scene méterben dolgozik (1 cm = 0.01 world unit).

> **Fejlesztőknek:** a teljes architektúra-leírás (adatmodell, render pipeline, gotchas, bővítési
> receptek, changelog) a [DEVELOPMENT.md](DEVELOPMENT.md)-ben. **Szabály: minden változásnál bővítsd.**

## Indítás
```bash
npm install
npm run dev      # fejlesztői szerver (http://localhost:5173)
npm run build    # produkciós build
npm test         # unit tesztek (pattern-generátorok)
```

## Funkciók
- **Csempetípusok**: név, méret (pl. 40×60 cm), több feltöltött kép (vegyes lerakás), fuga.
- **Szoba**: pontos méretű téglalap gyorslétrehozás, vagy szabad poligon rajzolás az
  alaprajzon; magasság megadása → padló + falak automatikusan származnak.
- **3D dobozok**: hozzáadás, alaprajzon húzással mozgatás, popupban méret/pozíció/forgatás.
- **Két nézet**: alaprajz (felülnézet, ortografikus) és 3D (perspektív, OrbitControls) —
  **ugyanaz a scene**, így a textúrák minden nézetben renderelve látszanak.
- **Oldal-szerkesztő**: a felület kiterített 2D nézetében alterületeket rajzolsz, mintát
  választasz (szimmetrikus rács / kötésben eltolt / halszálka), majd cellákat jelölsz ki
  és csempetípust rendelsz hozzájuk.

## Architektúra (fő mappák, `src/`)
- `model/` — tiszta típusok (`types.ts`) és geometria (`geometry.ts`: poligon→falak,
  doboz-oldalak, felület→világ transzformáció).
- `patterns/` — **bővíthető pattern-motor**: közös `PatternGenerator` interfész
  (`types.ts`), `grid` / `offset` / `herringbone` generátorok, `registry.ts`. Új minta
  (pl. Versailles) = új fájl + regisztráció, a render/UI nem változik.
- `render/` — `SurfaceTexture.ts`: a subRegion-ök + minta egy offscreen canvasra
  rajzolódnak (fugával, kép-kiosztással) → `THREE.CanvasTexture` a felület síkjára.
- `three/` — scene-komponensek (`SceneContents`, `FloorMesh`, `SurfacePlane`, `BoxGroup`)
  + `useSurfaceTexture` hook és `pose.ts` (felület→3D elhelyezés).
- `views/` — `PlanView`, `View3D`, `SurfaceEditor`.
- `panels/` — `RoomsPanel`, `TileLibraryPanel`, `BoxInspector`.
- `store/projectStore.ts` — zustand store, undo/redo, autosave.

## Pattern-motor
A `PatternGenerator.generate(bounds, ctx)` **abutáló** csempéket ad (fuga nélkül); a fuga
hézagot a renderer teszi hozzá (minden csempét grout/2-vel beljebb rajzol), így a fuga
egységesen kezelhető minden mintára. A halszálka rács hézag-/átfedésmentes a derivált
`v1=(W, L+W), v2=(W,-W)` rács-vektorokkal (rövid oldal = hosszú/2). A generátorokat
unit teszt fedi (`patterns.test.ts`): mintavételezi a belsőt és ellenőrzi a teljes lefedést.

## Jövőbeli bővítések
- Komplex minták (Versailles, francia, vegyes méretű modul) — a motor készen áll rá.
- Projekt export/import (JSON + képek), több projekt kezelése.
- Nyílászárók (ajtó/ablak kivágás), görbe falak.
- PBR anyagok (normal/roughness map), mennyiség-kalkuláció (m² / hulladék%).
