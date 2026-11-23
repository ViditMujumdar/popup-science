/** Shared pop-ups, stored as small JSON files in DATA_DIR (no photos are stored). */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface Store {
  put(json: string): Promise<string>;
  get(id: string): Promise<string | null>;
}

export const SHARE_ID = /^[A-Za-z0-9_-]{10}$/;

export async function createStore(dataDir: string): Promise<Store> {
  const dir = path.join(dataDir, 'shares');
  await fs.mkdir(dir, { recursive: true });
  return {
    async put(json) {
      const id = crypto.randomBytes(8).toString('base64url').slice(0, 10);
      const tmp = path.join(dir, `${id}.tmp`);
      await fs.writeFile(tmp, json, 'utf8');
      await fs.rename(tmp, path.join(dir, `${id}.json`));
      return id;
    },
    async get(id) {
      if (!SHARE_ID.test(id)) return null;
      try { return await fs.readFile(path.join(dir, `${id}.json`), 'utf8'); } catch { return null; }
    },
  };
}
