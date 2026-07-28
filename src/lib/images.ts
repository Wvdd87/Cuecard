import { get, set, del, createStore } from 'idb-keyval';

/**
 * Reference images (screen content / camera framing) are prep-view only and
 * can be large, so they are kept out of localStorage — which holds the
 * show-critical state and must stay small and instantly readable.
 */
const store = createStore('cuecard-images', 'images');

export function getImage(songId: string): Promise<string | undefined> {
  return get<string>(songId, store);
}

export function putImage(songId: string, dataUrl: string): Promise<void> {
  return set(songId, dataUrl, store);
}

export function deleteImage(songId: string): Promise<void> {
  return del(songId, store);
}

/** Downscale on import so a phone photo doesn't sit in the DB at 12 MP. */
export function fileToDataUrl(file: File, maxEdge = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => resolve(src);
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        if (scale === 1 && src.length < 900_000) return resolve(src);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
