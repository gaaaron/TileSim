import { openDB, IDBPDatabase } from 'idb';
import { Project } from '../model/types';

const DB_NAME = 'tilesim';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_IMAGES = 'images';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_PROJECTS)) {
          database.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_IMAGES)) {
          database.createObjectStore(STORE_IMAGES);
        }
      },
    });
  }
  return dbPromise;
}

/** A projekt mentésekor az object URL-eket nem perzisztáljuk (csak az id-ket). */
function stripUrls(project: Project): Project {
  return {
    ...project,
    tileTypes: project.tileTypes.map((t) => ({
      ...t,
      images: t.images.map((img) => ({ id: img.id, name: img.name })),
    })),
    models: (project.models ?? []).map((m) => ({ ...m, url: undefined })),
  };
}

export async function saveProject(project: Project): Promise<void> {
  const d = await db();
  await d.put(STORE_PROJECTS, stripUrls(project));
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const d = await db();
  return d.get(STORE_PROJECTS, id);
}

export async function listProjects(): Promise<Project[]> {
  const d = await db();
  return d.getAll(STORE_PROJECTS);
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  await d.delete(STORE_PROJECTS, id);
}

export async function saveImageBlob(id: string, blob: Blob): Promise<void> {
  const d = await db();
  await d.put(STORE_IMAGES, blob, id);
}

export async function loadImageBlob(id: string): Promise<Blob | undefined> {
  const d = await db();
  return d.get(STORE_IMAGES, id);
}

/** Object URL-eket gyárt egy projekt összes képéhez ÉS modelljéhez (betöltés után hívandó). */
export async function hydrateImageUrls(project: Project): Promise<Project> {
  for (const tile of project.tileTypes) {
    for (const img of tile.images) {
      if (!img.url) {
        const blob = await loadImageBlob(img.id);
        if (blob) img.url = URL.createObjectURL(blob);
      }
    }
  }
  for (const model of project.models ?? []) {
    if (!model.url) {
      const blob = await loadImageBlob(model.id);
      if (blob) model.url = URL.createObjectURL(blob);
    }
  }
  return project;
}

// ---- Export / Import (minden, a textúrákkal együtt; egyetlen JSON-fájlban, base64 képekkel) ----

interface ProjectExport {
  format: 'tilesim';
  version: number;
  project: Project; // url-ek nélkül
  images: Record<string, { name: string; type: string; data: string }>; // data = base64
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** A teljes projekt + összes textúra egyetlen letölthető JSON-blobban. */
export async function exportProjectBlob(project: Project): Promise<Blob> {
  const images: ProjectExport['images'] = {};
  const encode = async (id: string, name: string, fallbackType: string) => {
    if (images[id]) return;
    const blob = await loadImageBlob(id);
    if (blob) images[id] = { name, type: blob.type || fallbackType, data: await blobToBase64(blob) };
  };
  for (const tile of project.tileTypes) {
    for (const img of tile.images) await encode(img.id, img.name, 'image/png');
  }
  for (const model of project.models ?? []) await encode(model.id, model.name, 'model/gltf-binary');
  const payload: ProjectExport = { format: 'tilesim', version: 1, project: stripUrls(project), images };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

/** Importál egy export-fájlt: a képeket az IndexedDB-be írja, a (még nem mentett) projektet visszaadja. */
export async function importProjectFile(file: File): Promise<Project> {
  const payload = JSON.parse(await file.text()) as ProjectExport;
  if (payload.format !== 'tilesim' || !payload.project) {
    throw new Error('Érvénytelen TileSim export-fájl.');
  }
  for (const [id, info] of Object.entries(payload.images ?? {})) {
    await saveImageBlob(id, base64ToBlob(info.data, info.type));
  }
  return payload.project;
}
