import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  const existing = cache.get(url);
  if (existing) return Promise.resolve(existing);
  let p = loading.get(url);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        cache.set(url, img);
        loading.delete(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
    loading.set(url, p);
  }
  return p;
}

export function getCachedImage(url: string): HTMLImageElement | undefined {
  return cache.get(url);
}

/** React hook: betölti az url-eket, és újrarendereltet, ahogy elkészülnek. */
export function useImages(urls: string[]): Map<string, HTMLImageElement> {
  const [, setTick] = useState(0);
  const key = urls.slice().sort().join('|');
  useEffect(() => {
    let alive = true;
    for (const url of urls) {
      if (!cache.has(url)) {
        loadImage(url)
          .then(() => alive && setTick((t) => t + 1))
          .catch(() => {});
      }
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const map = new Map<string, HTMLImageElement>();
  for (const url of urls) {
    const img = cache.get(url);
    if (img) map.set(url, img);
  }
  return map;
}
