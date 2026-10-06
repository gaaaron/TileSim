import { create } from 'zustand';

export type Lang = 'hu' | 'en';

const LS_KEY = 'tilesim.lang';

/** Nyelv detektálása: mentett érték → böngésző/rendszer nyelv (hu* → magyar, egyébként angol). */
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'hu' || saved === 'en') return saved;
  } catch {
    /* localStorage nem elérhető → böngésző-nyelv */
  }
  const nav = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || '';
  return nav.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

type Dict = Record<string, string>;

const hu: Dict = {
  // App / toolbar
  'app.title': 'Csempe Szimulátor',
  'app.tab.plan': 'Alaprajz',
  'app.tab.3d': '3D nézet',
  'app.drawRoom': '+ Szoba rajzolása',
  'app.draw.points': '{n} pont — húzd a falakat (Shift = egyenes), a kezdőpontra kattintva záródik',
  'app.height': 'Magasság',
  'app.cm': 'cm',
  'app.done': 'Kész',
  'app.cancel': 'Mégse',
  'app.addBox': '+ Doboz',
  'app.undo': 'Visszavonás',
  'app.redo': 'Újra',
  'app.export': '⭳ Export',
  'app.exportTitle': 'Projekt exportálása (a textúrákkal)',
  'app.import': '⭱ Import',
  'app.importTitle': 'Projekt importálása',
  'app.importFailed': 'Importálás sikertelen: {msg}',
  'app.loading': 'Betöltés…',
  'app.hint.plan': 'Tipp: dobozokat húzással mozgathatsz. Dupla katt egy felületre = szerkesztés.',
  'app.hint.3d': 'Tipp: forgatás bal egér, dupla katt egy falra/padlóra/oldalra = csempe-szerkesztő.',
  'app.langTitle': 'Nyelv / Language',
  'group.rooms': 'Szobák',
  'group.surfaces': 'Oldalak',
  'group.tiles': 'Csempék',
  'group.objects': '3D objektumok',
  'group.materials': 'Anyagszükséglet',

  // RoomsPanel
  'rooms.rect': 'Téglalap (cm)',
  'rooms.heightAbbr': 'mag.',
  'rooms.addRect': '+ Téglalap szoba',
  'rooms.customHint': 'Egyedi alakhoz: „Szoba rajzolása" az alaprajz nézetben.',
  'rooms.dblEdit': 'Dupla katt: szerkesztés',
  'rooms.visibility': 'Láthatóság',
  'rooms.empty': 'Még nincs szoba.',

  // SurfacesPanel
  'surfaces.empty': 'Még nincs oldal. Hozz létre szobát vagy dobozt.',
  'surfaces.visibility': 'Láthatóság',
  'surfaces.editSurface': 'Oldal szerkesztése',

  // MaterialPanel
  'materials.empty': 'Nincs csempézett terület.',
  'materials.tile': 'Csempe',
  'materials.pcs': 'db',
  'materials.total': 'Összesen',
  'materials.note': 'A vágott darabok is 1 db-nak számítanak (becslés).',

  // ObjectsPanel
  'objects.loadFailed': 'A modell betöltése sikertelen: {msg}',
  'objects.loading': 'Betöltés…',
  'objects.upload': '+ Modell feltöltése (GLB/glTF)',
  'objects.placeInRoom': 'Elhelyezés a szobában',
  'objects.place': '+ Elhelyez',
  'objects.placed': 'Elhelyezett',
  'objects.hint': 'Húzással mozgathatók az alaprajzon; méret/forgatás a popupban.',

  // Box / Object inspector
  'inspector.widthX': 'Szélesség (X)',
  'inspector.heightY': 'Magasság (Y)',
  'inspector.depthZ': 'Mélység (Z)',
  'inspector.posX': 'Pozíció X',
  'inspector.posZ': 'Pozíció Z',
  'inspector.bottomY': 'Alja magasság (Y)',
  'inspector.rotation': 'Forgatás (°)',
  'inspector.deleteBox': 'Doboz törlése',
  'inspector.deleteObject': 'Objektum törlése',

  // TileInspector
  'tile.edit': 'Csempe szerkesztése',
  'tile.name': 'Név',
  'tile.size': 'Méret (cm)',
  'tile.color': 'Szín',
  'tile.colorHiddenImg': '(kép esetén nem látszik)',
  'tile.colorInstead': 'kép helyett ezzel renderel',
  'tile.gloss': 'Fényesség',
  'tile.brightness': 'Világosság',
  'tile.grout': 'Fuga',
  'tile.mm': 'mm',

  // TileLibraryPanel
  'tilelib.namePlaceholder': 'Név',
  'tilelib.size': 'Méret (cm)',
  'tilelib.addType': '+ Csempetípus',
  'tilelib.edit': 'Szerkesztés',
  'tilelib.delete': 'Törlés',
  'tilelib.plainColor': 'Sima szín',
  'tilelib.grout': 'Fuga',
  'tilelib.uploadImage': '+ Kép feltöltése',
  'tilelib.defaultName': 'Terrakotta',

  // RoomEditor
  'roomEditor.title': 'Szoba szerkesztése',
  'roomEditor.name': 'Név',
  'roomEditor.pos': 'Pozíció (cm)',
  'roomEditor.move': 'Áthelyez',
  'roomEditor.height': 'Magasság (cm)',
  'roomEditor.heightNote': 'az alterületek a padlóhoz rögzítve maradnak',
  'roomEditor.wallColor': 'Falak alapszíne',
  'roomEditor.wallColorNote': 'az összes oldalra (padló + falak)',

  // Favorite colors
  'fav.title': 'Kedvenc színek',
  'fav.current': 'Jelenlegi szín: {hex}',
  'fav.saved': 'Már mentve',
  'fav.save': '★ Mentés',
  'fav.savedList': 'Mentett színek',
  'fav.empty': 'Még nincs mentett szín. A fenti „★ Mentés"-sel adhatod hozzá a jelenlegit.',
  'fav.pick': 'Kiválasztás (alkalmazás): {name}',
  'fav.namePlaceholder': 'Név',
  'fav.editColor': 'A kedvenc szín módosítása',
  'fav.delete': 'Törlés',
  'colorField.title': 'Kedvenc színek (mentés / kiválasztás)',
  'fav.newColor': 'Új szín',

  // SurfaceEditor
  'se.title': 'Oldal szerkesztése — {label}',
  'se.baseColorTitle': 'Az oldal alapszíne (csempe nélküli rész)',
  'se.baseColor': 'Alapszín',
  'se.visibleTitle': 'A fal megjelenítése a 3D nézetben',
  'se.visible': 'Látható',
  'se.tabRegions': 'Alterületek',
  'se.tabCells': 'Cellák kijelölése',
  'se.hintRegion':
    'Üres helyre húzva új alterület. Csúcspontot húzva mozgatsz (Shift = derékszög), belül húzva az egészet mozgatod. Dupla katt egy élre = új pont; csúcspontra kattintva törölhető.',
  'se.hintCells': 'Kattints/húzz a cellák kijelöléséhez, majd rendelj hozzájuk csempét.',
  'se.regions': 'Alterületek',
  'se.regionItem': 'Alterület #{n} ({pattern})',
  'se.noRegions': 'Még nincs alterület.',
  'se.size': 'Méret (cm)',
  'se.pivotTitle': 'Pivot: mi maradjon helyben átméretezéskor',
  'se.pivotPoint': 'Pivot pont',
  'se.resize': 'Átméretez',
  'se.pos': 'Pozíció (cm)',
  'se.move': 'Áthelyez',
  'se.pattern': 'Minta',
  'se.type': 'Típus',
  'se.baseTile': 'Alap csempe',
  'se.none': '— nincs —',
  'se.tileRotated': 'Csempe 90°-kal elforgatva',
  'se.rotation': 'Elforgatás: {n}°',
  'se.offsetUV': 'Eltolás u/v (cm)',
  'se.selectedCells': 'Kijelölt cellák ({n})',
  'se.chooseTile': '— válassz csempét —',
  'se.assignTile': 'Csempe a kijelöltekhez',
  'se.stepTextureTitle': 'A kijelölt cella(k) textúrájának léptetése a csempe képei között',
  'se.stepTexture': '⟳ Textúra léptetése',
  'se.clearSelection': 'Kijelölés törlése',
  'se.textureAssign': 'Textúra-kiosztás',
  'se.randomTitle': 'Az alterület minden cellájára véletlen textúra a csempe képei közül',
  'se.random': '🎲 Véletlen kiosztás',
  'se.deleteVertex': 'Pont törlése',

  // Pattern generators
  'pattern.grid': 'Szimmetrikus rács',
  'pattern.offset': 'Kötésben eltolt',
  'pattern.herringbone': 'Halszálka',
  'patternParam.offset': 'Eltolás (csempe arány)',

  // Derived surface labels + default names
  'label.floor': 'padló',
  'label.ceiling': 'mennyezet',
  'label.wall': 'fal',
  'face.front': 'eleje (+Z)',
  'face.back': 'hátulja (-Z)',
  'face.right': 'jobb (+X)',
  'face.left': 'bal (-X)',
  'face.top': 'teteje (+Y)',
  'face.bottom': 'alja (-Y)',
  'name.room': 'Szoba',
  'name.box': 'Doboz',
  'name.project': 'Új projekt',
};

const en: Dict = {
  'app.title': 'Tile Simulator',
  'app.tab.plan': 'Floor plan',
  'app.tab.3d': '3D view',
  'app.drawRoom': '+ Draw room',
  'app.draw.points': '{n} points — drag the walls (Shift = straight), click the start point to close',
  'app.height': 'Height',
  'app.cm': 'cm',
  'app.done': 'Done',
  'app.cancel': 'Cancel',
  'app.addBox': '+ Box',
  'app.undo': 'Undo',
  'app.redo': 'Redo',
  'app.export': '⭳ Export',
  'app.exportTitle': 'Export project (with textures)',
  'app.import': '⭱ Import',
  'app.importTitle': 'Import project',
  'app.importFailed': 'Import failed: {msg}',
  'app.loading': 'Loading…',
  'app.hint.plan': 'Tip: drag boxes to move them. Double-click a surface to edit.',
  'app.hint.3d': 'Tip: left mouse to rotate; double-click a wall/floor/side to open the tile editor.',
  'app.langTitle': 'Language / Nyelv',
  'group.rooms': 'Rooms',
  'group.surfaces': 'Surfaces',
  'group.tiles': 'Tiles',
  'group.objects': '3D objects',
  'group.materials': 'Materials',

  'rooms.rect': 'Rectangle (cm)',
  'rooms.heightAbbr': 'h',
  'rooms.addRect': '+ Rectangle room',
  'rooms.customHint': 'For a custom shape: “Draw room” in the floor-plan view.',
  'rooms.dblEdit': 'Double-click: edit',
  'rooms.visibility': 'Visibility',
  'rooms.empty': 'No rooms yet.',

  'surfaces.empty': 'No surfaces yet. Create a room or a box.',
  'surfaces.visibility': 'Visibility',
  'surfaces.editSurface': 'Edit surface',

  'materials.empty': 'No tiled area.',
  'materials.tile': 'Tile',
  'materials.pcs': 'pcs',
  'materials.total': 'Total',
  'materials.note': 'Cut pieces also count as 1 (estimate).',

  'objects.loadFailed': 'Failed to load model: {msg}',
  'objects.loading': 'Loading…',
  'objects.upload': '+ Upload model (GLB/glTF)',
  'objects.placeInRoom': 'Place in the room',
  'objects.place': '+ Place',
  'objects.placed': 'Placed',
  'objects.hint': 'Drag to move on the floor plan; size/rotation in the popup.',

  'inspector.widthX': 'Width (X)',
  'inspector.heightY': 'Height (Y)',
  'inspector.depthZ': 'Depth (Z)',
  'inspector.posX': 'Position X',
  'inspector.posZ': 'Position Z',
  'inspector.bottomY': 'Bottom height (Y)',
  'inspector.rotation': 'Rotation (°)',
  'inspector.deleteBox': 'Delete box',
  'inspector.deleteObject': 'Delete object',

  'tile.edit': 'Edit tile',
  'tile.name': 'Name',
  'tile.size': 'Size (cm)',
  'tile.color': 'Color',
  'tile.colorHiddenImg': '(hidden when an image is set)',
  'tile.colorInstead': 'rendered instead of an image',
  'tile.gloss': 'Glossiness',
  'tile.brightness': 'Brightness',
  'tile.grout': 'Grout',
  'tile.mm': 'mm',

  'tilelib.namePlaceholder': 'Name',
  'tilelib.size': 'Size (cm)',
  'tilelib.addType': '+ Tile type',
  'tilelib.edit': 'Edit',
  'tilelib.delete': 'Delete',
  'tilelib.plainColor': 'Plain color',
  'tilelib.grout': 'Grout',
  'tilelib.uploadImage': '+ Upload image',
  'tilelib.defaultName': 'Terracotta',

  'roomEditor.title': 'Edit room',
  'roomEditor.name': 'Name',
  'roomEditor.pos': 'Position (cm)',
  'roomEditor.move': 'Move',
  'roomEditor.height': 'Height (cm)',
  'roomEditor.heightNote': 'subregions stay anchored to the floor',
  'roomEditor.wallColor': 'Wall base color',
  'roomEditor.wallColorNote': 'for all surfaces (floor + walls)',

  'fav.title': 'Favorite colors',
  'fav.current': 'Current color: {hex}',
  'fav.saved': 'Already saved',
  'fav.save': '★ Save',
  'fav.savedList': 'Saved colors',
  'fav.empty': 'No saved colors yet. Add the current one with “★ Save” above.',
  'fav.pick': 'Select (apply): {name}',
  'fav.namePlaceholder': 'Name',
  'fav.editColor': 'Change the favorite color',
  'fav.delete': 'Delete',
  'colorField.title': 'Favorite colors (save / select)',
  'fav.newColor': 'New color',

  'se.title': 'Edit surface — {label}',
  'se.baseColorTitle': 'Surface base color (area without tiles)',
  'se.baseColor': 'Base color',
  'se.visibleTitle': 'Show the wall in 3D view',
  'se.visible': 'Visible',
  'se.tabRegions': 'Subregions',
  'se.tabCells': 'Select cells',
  'se.hintRegion':
    'Drag on empty space for a new subregion. Drag a vertex to move it (Shift = right angle), drag inside to move the whole thing. Double-click an edge = new vertex; click a vertex to delete it.',
  'se.hintCells': 'Click/drag to select cells, then assign a tile to them.',
  'se.regions': 'Subregions',
  'se.regionItem': 'Subregion #{n} ({pattern})',
  'se.noRegions': 'No subregions yet.',
  'se.size': 'Size (cm)',
  'se.pivotTitle': 'Pivot: what stays in place when resizing',
  'se.pivotPoint': 'Pivot point',
  'se.resize': 'Resize',
  'se.pos': 'Position (cm)',
  'se.move': 'Move',
  'se.pattern': 'Pattern',
  'se.type': 'Type',
  'se.baseTile': 'Base tile',
  'se.none': '— none —',
  'se.tileRotated': 'Tile rotated 90°',
  'se.rotation': 'Rotation: {n}°',
  'se.offsetUV': 'Offset u/v (cm)',
  'se.selectedCells': 'Selected cells ({n})',
  'se.chooseTile': '— choose a tile —',
  'se.assignTile': 'Assign tile to selection',
  'se.stepTextureTitle': 'Cycle the selected cell(s) texture through the tile images',
  'se.stepTexture': '⟳ Cycle texture',
  'se.clearSelection': 'Clear selection',
  'se.textureAssign': 'Texture assignment',
  'se.randomTitle': 'Random texture for every cell of the subregion from the tile images',
  'se.random': '🎲 Randomize',
  'se.deleteVertex': 'Delete point',

  'pattern.grid': 'Symmetric grid',
  'pattern.offset': 'Offset bond',
  'pattern.herringbone': 'Herringbone',
  'patternParam.offset': 'Offset (tile ratio)',

  'label.floor': 'floor',
  'label.ceiling': 'ceiling',
  'label.wall': 'wall',
  'face.front': 'front (+Z)',
  'face.back': 'back (-Z)',
  'face.right': 'right (+X)',
  'face.left': 'left (-X)',
  'face.top': 'top (+Y)',
  'face.bottom': 'bottom (-Y)',
  'name.room': 'Room',
  'name.box': 'Box',
  'name.project': 'New project',
};

const dicts: Record<Lang, Dict> = { hu, en };

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

/** Aktuális nyelv (zustand) — a komponensek `useT()`-n át iratkoznak fel rá. */
export const useLangStore = create<LangState>((set) => ({
  lang: detectLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch {
      /* ignore */
    }
    set({ lang });
  },
}));

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Fordítás React-en KÍVÜL (pl. geometry.ts címkék, store alap-nevek). Az aktuális nyelvet olvassa. */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const lang = useLangStore.getState().lang;
  const s = dicts[lang][key] ?? dicts.hu[key] ?? key;
  return interpolate(s, vars);
}

/** React hook: fordító függvény, ami a nyelvváltásra újrarendereli a komponenst. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key: string, vars?: Record<string, string | number>): string => {
    const s = dicts[lang][key] ?? dicts.hu[key] ?? key;
    return interpolate(s, vars);
  };
}
