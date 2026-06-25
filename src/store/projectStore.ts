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
  hydrateImageUrls,
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
  };
}

interface State {
  project: Project;
  viewMode: ViewMode;
  planTool: PlanTool;
  draftRoom: { x: number; y: number }[] | null;
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
  cancelDraftRoom: () => void;

  // boxes
  addBox: () => void;
  updateBox: (id: string, patch: Partial<Box>) => void;
  removeBox: (id: string) => void;

  // surfaces
  getSubRegions: (surfaceId: string) => SubRegion[];
  addSubRegion: (surfaceId: string, rect: SubRegion['rect']) => string;
  updateSubRegionPattern: (surfaceId: string, subId: string, patch: Partial<PatternConfig>) => void;
  updateSubRegionRect: (surfaceId: string, subId: string, rect: SubRegion['rect']) => void;
  removeSubRegion: (surfaceId: string, subId: string) => void;
  assignTileToCells: (surfaceId: string, subId: string, cellIds: string[], tileTypeId: string) => void;

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
        project = await hydrateImageUrls(project);
        // biztonság: hiányzó mezők pótlása régi mentésnél
        project.surfaceData ??= {};
        project.boxes ??= [];
        project.rooms ??= [];
        project.tileTypes ??= [];
      }
      set({ project, loaded: true });
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
      return base.map((s) => ({ ...s, subRegions: p.surfaceData[s.id] ?? [] }));
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
    cancelDraftRoom: () => set({ planTool: 'select', draftRoom: null }),

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
    addSubRegion: (surfaceId, rect) => {
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
        list.push({ id, rect, pattern, tileOverrides: {} });
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
    updateSubRegionRect: (surfaceId, subId, rect) =>
      mutate((p) => {
        const sub = (p.surfaceData[surfaceId] ?? []).find((s) => s.id === subId);
        if (sub) sub.rect = rect;
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
