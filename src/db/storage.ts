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

/** A projekt mentésekor az object URL-eket nem perzisztáljuk (csak a kép-id-ket). */
function stripUrls(project: Project): Project {
  return {
    ...project,
    tileTypes: project.tileTypes.map((t) => ({
      ...t,
      images: t.images.map((img) => ({ id: img.id, name: img.name })),
    })),
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

/** Object URL-eket gyárt egy projekt összes képéhez (betöltés után hívandó). */
export async function hydrateImageUrls(project: Project): Promise<Project> {
  for (const tile of project.tileTypes) {
    for (const img of tile.images) {
      if (!img.url) {
        const blob = await loadImageBlob(img.id);
        if (blob) img.url = URL.createObjectURL(blob);
      }
    }
  }
  return project;
}
