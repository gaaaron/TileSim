import { create } from 'zustand';
import {
  Box,
  ImageRef,
  ModelAsset,
  PatternConfig,
  Project,
  Room,
  SceneObject,
  SubRegion,
  Surface,
  TileType,
  uid,
} from '../model/types';
import { allSurfaces, roomForPoint } from '../model/geometry';
import { loadModelBBox } from '../three/modelUtils';
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
    models: [],
    objects: [],
    surfaceData: {},
    surfaceHidden: {},
    roomHidden: {},
    surfaceBaseColor: {},
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
  project.surfaceBaseColor ??= {};
  project.models ??= [];
  project.objects ??= [];
  for (const t of project.tileTypes) {
    t.color ??= '#c9c4b8';
    t.glossiness ??= 0;
  }
  for (const o of project.objects) {
    if (!o.roomId) o.roomId = (roomForPoint(project.rooms, o.pos.x, o.pos.z) ?? project.rooms[0])?.id;
  }
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
  // dobozok szobához rendelése (pozíció alapján), ha még nincs
  for (const box of project.boxes) {
    if (!box.roomId) {
      box.roomId = (roomForPoint(project.rooms, box.pos.x, box.pos.z) ?? project.rooms[0])?.id;
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
  selectedObjectId: string | null;
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

  // 3D objektumok (GLB)
  selectObject: (id: string | null) => void;
  addModelAsset: (file: File) => Promise<string>;
  addObject: (modelId: string) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;

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
  setSurfaceBaseColor: (surfaceId: string, color: string) => void;
  setRoomSurfacesBaseColor: (roomId: string, color: string) => void;

  // húzás-koalescálás (egy undo-lépés / húzás): mozgatás, átméretezés
  beginDrag: () => void;
  endDrag: () => void;

  undo: () => void;
  redo: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Húzás közben (mozgatás/átméretezés) NEM rakunk minden mozdulatot a history-ba:
// a beginDrag egyszer pillanatképet ment, a köztes mutációk pedig elnyomják a push-t.
let suppressHistory = false;

export const useStore = create<State>((set, get) => {
  // debounce-olt autosave: MINDIG a legfrissebb projektet menti (nem egy elavult pillanatképet),
  // különben egy késleltetett mentés felülírhatna pl. egy importot
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveProject(get().project).catch(console.error), 400);
  };

  // segéd: mutáció history-val + autosave-vel
  const mutate = (fn: (p: Project) => Project) => {
    const prev = get().project;
    const next = fn(structuredClone(prev));
    if (suppressHistory) {
      set({ project: next });
    } else {
      set({ project: next, past: [...get().past, prev].slice(-50), future: [] });
    }
    scheduleSave();
  };

  return {
    project: emptyProject(),
    viewMode: 'plan',
    planTool: 'select',
    draftRoom: null,
    draftHeightCm: 270,
    selectedBoxId: null,
    selectedObjectId: null,
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
    selectBox: (id) => set({ selectedBoxId: id, selectedObjectId: null, selectedSurfaceId: null }),
    selectObject: (id) => set({ selectedObjectId: id, selectedBoxId: null, selectedSurfaceId: null }),
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
        baseColor: p.surfaceBaseColor?.[s.id] ?? s.baseColor,
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
          color: '#c9c4b8',
          glossiness: 0,
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
          roomId: (roomForPoint(p.rooms, cx, cz) ?? p.rooms[0])?.id,
        });
        return p;
      }),
    updateBox: (id, patch) =>
      mutate((p) => {
        const b = p.boxes.find((x) => x.id === id);
        if (b) {
          Object.assign(b, patch);
          // a doboz ahhoz a szobához tartozik, amelyikben épp van (ha van ilyen)
          const r = roomForPoint(p.rooms, b.pos.x, b.pos.z);
          if (r) b.roomId = r.id;
        }
        return p;
      }),
    removeBox: (id) =>
      mutate((p) => {
        p.boxes = p.boxes.filter((x) => x.id !== id);
        return p;
      }),

    addModelAsset: async (file) => {
      const id = uid('model_');
      await saveImageBlob(id, file); // a GLB blob a generikus blob-tárba
      const bb = await loadModelBBox(file); // natív befoglaló (modell-egység ≈ m)
      const naturalSize = {
        w: Math.max(1, Math.round(bb.x * 100)),
        h: Math.max(1, Math.round(bb.y * 100)),
        d: Math.max(1, Math.round(bb.z * 100)),
      };
      const model: ModelAsset = {
        id,
        name: file.name.replace(/\.[^.]+$/, ''),
        naturalSize,
        url: URL.createObjectURL(file),
      };
      mutate((p) => {
        p.models.push(model);
        return p;
      });
      return id;
    },
    addObject: (modelId) =>
      mutate((p) => {
        const model = p.models.find((m) => m.id === modelId);
        if (!model) return p;
        let cx = 0;
        let cz = 0;
        if (p.rooms[0]) {
          const poly = p.rooms[0].floorPolygon;
          cx = poly.reduce((s, q) => s + q.x, 0) / poly.length;
          cz = poly.reduce((s, q) => s + q.y, 0) / poly.length;
        }
        p.objects.push({
          id: uid('obj_'),
          name: `${model.name} ${p.objects.length + 1}`,
          modelId,
          pos: { x: cx, y: 0, z: cz },
          size: { ...model.naturalSize },
          rotationY: 0,
          roomId: (roomForPoint(p.rooms, cx, cz) ?? p.rooms[0])?.id,
        });
        return p;
      }),
    updateObject: (id, patch) =>
      mutate((p) => {
        const o = p.objects.find((x) => x.id === id);
        if (o) {
          Object.assign(o, patch);
          const r = roomForPoint(p.rooms, o.pos.x, o.pos.z);
          if (r) o.roomId = r.id;
        }
        return p;
      }),
    removeObject: (id) =>
      mutate((p) => {
        p.objects = p.objects.filter((x) => x.id !== id);
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
    setSurfaceBaseColor: (surfaceId, color) =>
      mutate((p) => {
        p.surfaceBaseColor ??= {};
        p.surfaceBaseColor[surfaceId] = color;
        return p;
      }),
    setRoomSurfacesBaseColor: (roomId, color) =>
      mutate((p) => {
        p.surfaceBaseColor ??= {};
        const room = p.rooms.find((r) => r.id === roomId);
        if (room) {
          p.surfaceBaseColor[`${roomId}:floor`] = color;
          p.surfaceBaseColor[`${roomId}:ceiling`] = color;
          for (let i = 0; i < room.floorPolygon.length; i++) {
            p.surfaceBaseColor[`${roomId}:wall:${i}`] = color;
          }
        }
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
      scheduleSave();
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      const next = future[0];
      set({ project: next, past: [...past, project], future: future.slice(1) });
      scheduleSave();
    },
  };
});

// Fejlesztői hozzáférés a store-hoz (csak dev): manuális teszt/automatizálás.
if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useStore }).store = useStore;
}
