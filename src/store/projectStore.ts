import { create } from 'zustand';
import {
  Box,
  ImageRef,
  PatternConfig,
  Project,
  Room,
  SubRegion,
  Surface,
  TileType,
  uid,
} from '../model/types';
import { allSurfaces } from '../model/geometry';
import {
  exportProjectBlob,
  hydrateImageUrls,
  importProjectFile,
  listProjects,
  loadProject,
  saveImageBlob,
  saveProject,
} from '../db/storage';

export type ViewMode = 'plan' | '3d';
export type PlanTool = 'select' | 'draw-room';

const DEFAULT_PROJECT_ID = 'default';

function emptyProject(): Project {
  return {
    id: DEFAULT_PROJECT_ID,
    name: 'Új projekt',
    tileTypes: [],
    rooms: [],
    boxes: [],
    surfaceData: {},
    surfaceHidden: {},
    roomHidden: {},
  };
}

/** Hiányzó mezők pótlása + régi adat migrálása (betöltésnél és importnál egyaránt). */
function migrateProject(project: Project): Project {
  project.surfaceData ??= {};
  project.boxes ??= [];
  project.rooms ??= [];
  project.tileTypes ??= [];
  project.surfaceHidden ??= {};
  project.roomHidden ??= {};
  for (const list of Object.values(project.surfaceData)) {
    for (const sub of list as Array<SubRegion & { rect?: { u: number; v: number; w: number; h: number } }>) {
      if (!sub.polygon && sub.rect) {
        const r = sub.rect;
        sub.polygon = [
          { x: r.u, y: r.v },
          { x: r.u + r.w, y: r.v },
          { x: r.u + r.w, y: r.v + r.h },
          { x: r.u, y: r.v + r.h },
        ];
        delete sub.rect;
      }
      sub.imageOverrides ??= {};
    }
  }
  return project;
}

interface State {
  project: Project;
  viewMode: ViewMode;
  planTool: PlanTool;
  draftRoom: { x: number; y: number }[] | null;
  draftHeightCm: number;
  selectedBoxId: string | null;
  selectedSurfaceId: string | null;
  editingSurfaceId: string | null;
  selectedSubRegionId: string | null;
  selectedCells: string[];
  loaded: boolean;

  // history
  past: Project[];
  future: Project[];

  // lifecycle
  init: () => Promise<void>;
  exportProject: () => Promise<void>;
  importProject: (file: File) => Promise<void>;

  // ui
  setViewMode: (m: ViewMode) => void;
  setPlanTool: (t: PlanTool) => void;
  selectBox: (id: string | null) => void;
  selectSurface: (id: string | null) => void;
  openSurfaceEditor: (id: string | null) => void;
  selectSubRegion: (id: string | null) => void;
  setSelectedCells: (cells: string[]) => void;

  // derived
  surfaces: () => Surface[];

  // tiles
  addTileType: (name: string, widthCm: number, heightCm: number) => string;
  updateTileType: (id: string, patch: Partial<TileType>) => void;
  removeTileType: (id: string) => void;
  addImagesToTile: (tileId: string, files: File[]) => Promise<void>;

  // rooms
  addRoom: (polygon: { x: number; y: number }[], heightCm: number) => void;
  updateRoom: (id: string, patch: Partial<Room>) => void;
  removeRoom: (id: string) => void;
  startDraftRoom: () => void;
  addDraftPoint: (x: number, y: number) => void;
  updateDraftPoint: (i: number, x: number, y: number) => void;
  setDraftHeight: (h: number) => void;
  commitDraftRoom: () => void;
  cancelDraftRoom: () => void;
  // meglévő szoba csúcspontjainak szerkesztése
  moveRoomVertex: (roomId: string, index: number, x: number, y: number) => void;
  insertRoomVertex: (roomId: string, edgeIndex: number, x: number, y: number) => void;
  deleteRoomVertex: (roomId: string, index: number) => void;

  // boxes
  addBox: () => void;
  updateBox: (id: string, patch: Partial<Box>) => void;
  removeBox: (id: string) => void;

  // surfaces
  getSubRegions: (surfaceId: string) => SubRegion[];
  addSubRegion: (surfaceId: string, polygon: SubRegion['polygon']) => string;
  updateSubRegionPattern: (surfaceId: string, subId: string, patch: Partial<PatternConfig>) => void;
  updateSubRegionPolygon: (surfaceId: string, subId: string, polygon: SubRegion['polygon']) => void;
  moveSubRegionVertex: (surfaceId: string, subId: string, index: number, x: number, y: number) => void;
  insertSubRegionVertex: (surfaceId: string, subId: string, edgeIndex: number, x: number, y: number) => void;
  deleteSubRegionVertex: (surfaceId: string, subId: string, index: number) => void;
  removeSubRegion: (surfaceId: string, subId: string) => void;
  assignTileToCells: (surfaceId: string, subId: string, cellIds: string[], tileTypeId: string) => void;
  /** Per-cella kép-index felülírások összefésülése (textúra léptetés / véletlen kiosztás). */
  setCellImageOverrides: (surfaceId: string, subId: string, overrides: Record<string, number>) => void;
  setSurfaceHidden: (surfaceId: string, hidden: boolean) => void;
  toggleSurfaceHidden: (surfaceId: string) => void;
  setRoomHidden: (roomId: string, hidden: boolean) => void;
  toggleRoomHidden: (roomId: string) => void;

  // húzás-koalescálás (egy undo-lépés / húzás): mozgatás, átméretezés
  beginDrag: () => void;
  endDrag: () => void;

  undo: () => void;
  redo: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(project: Project) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveProject(project).catch(console.error), 400);
}

// Húzás közben (mozgatás/átméretezés) NEM rakunk minden mozdulatot a history-ba:
// a beginDrag egyszer pillanatképet ment, a köztes mutációk pedig elnyomják a push-t.
let suppressHistory = false;

export const useStore = create<State>((set, get) => {
  // segéd: mutáció history-val + autosave-vel
  const mutate = (fn: (p: Project) => Project) => {
    const prev = get().project;
    const next = fn(structuredClone(prev));
    if (suppressHistory) {
      set({ project: next });
    } else {
      set({ project: next, past: [...get().past, prev].slice(-50), future: [] });
    }
    scheduleSave(next);
  };

  return {
    project: emptyProject(),
    viewMode: 'plan',
    planTool: 'select',
    draftRoom: null,
    draftHeightCm: 270,
    selectedBoxId: null,
    selectedSurfaceId: null,
    editingSurfaceId: null,
    selectedSubRegionId: null,
    selectedCells: [],
    loaded: false,
    past: [],
    future: [],

    init: async () => {
      let project = await loadProject(DEFAULT_PROJECT_ID);
      if (!project) {
        project = emptyProject();
        await saveProject(project);
      } else {
        project = migrateProject(await hydrateImageUrls(project));
      }
      set({ project, loaded: true });
    },

    exportProject: async () => {
      const project = get().project;
      const blob = await exportProjectBlob(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safe = (project.name || 'projekt').replace(/[^\w\-]+/g, '_');
      a.href = url;
      a.download = `${safe}.tilesim.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    importProject: async (file) => {
      const parsed = await importProjectFile(file); // a képeket az IndexedDB-be írja
      const project = migrateProject(parsed);
      project.id = DEFAULT_PROJECT_ID; // az aktuális projektet írja felül
      await saveProject(project);
      const hydrated = await hydrateImageUrls(project);
      set({
        project: hydrated,
        past: [],
        future: [],
        selectedBoxId: null,
        selectedSurfaceId: null,
        editingSurfaceId: null,
        selectedSubRegionId: null,
        selectedCells: [],
      });
    },

    setViewMode: (m) => set({ viewMode: m }),
    setPlanTool: (t) => set({ planTool: t }),
    selectBox: (id) => set({ selectedBoxId: id, selectedSurfaceId: null }),
    selectSurface: (id) => set({ selectedSurfaceId: id }),
    openSurfaceEditor: (id) =>
      set({ editingSurfaceId: id, selectedSubRegionId: null, selectedCells: [] }),
    selectSubRegion: (id) => set({ selectedSubRegionId: id, selectedCells: [] }),
    setSelectedCells: (cells) => set({ selectedCells: cells }),

    surfaces: () => {
      const p = get().project;
      const base = allSurfaces(p.rooms, p.boxes);
      return base.map((s) => ({
        ...s,
        subRegions: p.surfaceData[s.id] ?? [],
        hidden: !!p.surfaceHidden?.[s.id],
      }));
    },

    addTileType: (name, widthCm, heightCm) => {
      const id = uid('tile_');
      mutate((p) => {
        p.tileTypes.push({
          id,
          name,
          widthCm,
          heightCm,
          images: [],
          groutMm: 3,
          groutColor: '#cccccc',
        });
        return p;
      });
      return id;
    },
    updateTileType: (id, patch) =>
      mutate((p) => {
        const t = p.tileTypes.find((x) => x.id === id);
        if (t) Object.assign(t, patch);
        return p;
      }),
    removeTileType: (id) =>
      mutate((p) => {
        p.tileTypes = p.tileTypes.filter((x) => x.id !== id);
        return p;
      }),
    addImagesToTile: async (tileId, files) => {
      const refs: ImageRef[] = [];
      for (const file of files) {
        const id = uid('img_');
        await saveImageBlob(id, file);
        refs.push({ id, name: file.name, url: URL.createObjectURL(file) });
      }
      mutate((p) => {
        const t = p.tileTypes.find((x) => x.id === tileId);
        if (t) t.images.push(...refs);
        return p;
      });
    },

    addRoom: (polygon, heightCm) =>
      mutate((p) => {
        p.rooms.push({
          id: uid('room_'),
          name: `Szoba ${p.rooms.length + 1}`,
          floorPolygon: polygon,
          heightCm,
        });
        return p;
      }),
    updateRoom: (id, patch) =>
      mutate((p) => {
        const r = p.rooms.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
        return p;
      }),
    removeRoom: (id) =>
      mutate((p) => {
        p.rooms = p.rooms.filter((x) => x.id !== id);
        return p;
      }),
    startDraftRoom: () => set({ planTool: 'draw-room', draftRoom: [] }),
    addDraftPoint: (x, y) => set({ draftRoom: [...(get().draftRoom ?? []), { x, y }] }),
    updateDraftPoint: (i, x, y) =>
      set((st) => {
        const d = st.draftRoom ? [...st.draftRoom] : [];
        if (d[i]) d[i] = { x, y };
        return { draftRoom: d };
      }),
    setDraftHeight: (h) => set({ draftHeightCm: h }),
    commitDraftRoom: () => {
      const { draftRoom, draftHeightCm } = get();
      if (draftRoom && draftRoom.length >= 3) get().addRoom(draftRoom, draftHeightCm);
      set({ planTool: 'select', draftRoom: null });
    },
    cancelDraftRoom: () => set({ planTool: 'select', draftRoom: null }),
    moveRoomVertex: (roomId, index, x, y) =>
      mutate((p) => {
        const r = p.rooms.find((x) => x.id === roomId);
        if (r && r.floorPolygon[index]) r.floorPolygon[index] = { x, y };
        return p;
      }),
    insertRoomVertex: (roomId, edgeIndex, x, y) =>
      mutate((p) => {
        const r = p.rooms.find((x) => x.id === roomId);
        if (r) r.floorPolygon.splice(edgeIndex + 1, 0, { x, y });
        return p;
      }),
    deleteRoomVertex: (roomId, index) =>
      mutate((p) => {
        const r = p.rooms.find((x) => x.id === roomId);
        if (r && r.floorPolygon.length > 3) r.floorPolygon.splice(index, 1);
        return p;
      }),

    addBox: () =>
      mutate((p) => {
        // az első szoba közepére, vagy origóba
        let cx = 0;
        let cz = 0;
        if (p.rooms[0]) {
          const poly = p.rooms[0].floorPolygon;
          cx = poly.reduce((s, q) => s + q.x, 0) / poly.length;
          cz = poly.reduce((s, q) => s + q.y, 0) / poly.length;
        }
        p.boxes.push({
          id: uid('box_'),
          name: `Doboz ${p.boxes.length + 1}`,
          pos: { x: cx, y: 0, z: cz },
          size: { w: 60, h: 80, d: 60 },
          rotationY: 0,
        });
        return p;
      }),
    updateBox: (id, patch) =>
      mutate((p) => {
        const b = p.boxes.find((x) => x.id === id);
        if (b) Object.assign(b, patch);
        return p;
      }),
    removeBox: (id) =>
      mutate((p) => {
        p.boxes = p.boxes.filter((x) => x.id !== id);
        return p;
      }),

    getSubRegions: (surfaceId) => get().project.surfaceData[surfaceId] ?? [],
    addSubRegion: (surfaceId, polygon) => {
      const id = uid('sub_');
      mutate((p) => {
        const pattern: PatternConfig = {
          generator: 'grid',
          defaultTileTypeId: p.tileTypes[0]?.id ?? null,
          angleDeg: 0,
          originOffset: { x: 0, y: 0 },
          params: {},
        };
        const list = p.surfaceData[surfaceId] ?? (p.surfaceData[surfaceId] = []);
        list.push({ id, polygon, pattern, tileOverrides: {}, imageOverrides: {} });
        return p;
      });
      return id;
    },
    updateSubRegionPattern: (surfaceId, subId, patch) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub) Object.assign(sub.pattern, patch);
        return p;
      }),
    updateSubRegionPolygon: (surfaceId, subId, polygon) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub) sub.polygon = polygon;
        return p;
      }),
    moveSubRegionVertex: (surfaceId, subId, index, x, y) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub && sub.polygon[index]) sub.polygon[index] = { x, y };
        return p;
      }),
    insertSubRegionVertex: (surfaceId, subId, edgeIndex, x, y) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub) sub.polygon.splice(edgeIndex + 1, 0, { x, y });
        return p;
      }),
    deleteSubRegionVertex: (surfaceId, subId, index) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub && sub.polygon.length > 3) sub.polygon.splice(index, 1);
        return p;
      }),
    removeSubRegion: (surfaceId, subId) =>
      mutate((p) => {
        p.surfaceData[surfaceId] = (p.surfaceData[surfaceId] ?? []).filter((s) => s.id !== subId);
        return p;
      }),
    assignTileToCells: (surfaceId, subId, cellIds, tileTypeId) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub) for (const c of cellIds) sub.tileOverrides[c] = tileTypeId;
        return p;
      }),
    setCellImageOverrides: (surfaceId, subId, overrides) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub) {
          sub.imageOverrides ??= {};
          Object.assign(sub.imageOverrides, overrides);
        }
        return p;
      }),
    setSurfaceHidden: (surfaceId, hidden) =>
      mutate((p) => {
        p.surfaceHidden ??= {};
        if (hidden) p.surfaceHidden[surfaceId] = true;
        else delete p.surfaceHidden[surfaceId];
        return p;
      }),
    toggleSurfaceHidden: (surfaceId) =>
      get().setSurfaceHidden(surfaceId, !get().project.surfaceHidden?.[surfaceId]),
    setRoomHidden: (roomId, hidden) =>
      mutate((p) => {
        p.roomHidden ??= {};
        if (hidden) p.roomHidden[roomId] = true;
        else delete p.roomHidden[roomId];
        return p;
      }),
    toggleRoomHidden: (roomId) =>
      get().setRoomHidden(roomId, !get().project.roomHidden?.[roomId]),

    beginDrag: () => {
      // egyetlen pillanatkép a húzás elejéről, majd a köztes mutációk nem rakódnak history-ba
      const { past, project } = get();
      set({ past: [...past, project].slice(-50), future: [] });
      suppressHistory = true;
    },
    endDrag: () => {
      suppressHistory = false;
    },

    undo: () => {
      const { past, project, future } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({ project: prev, past: past.slice(0, -1), future: [project, ...future] });
      scheduleSave(prev);
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      const next = future[0];
      set({ project: next, past: [...past, project], future: future.slice(1) });
      scheduleSave(next);
    },
  };
});

// Fejlesztői hozzáférés a store-hoz (csak dev): manuális teszt/automatizálás.
if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useStore }).store = useStore;
}
