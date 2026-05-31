import { readdir, stat, open } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { parseSessionMeta, type SessionMeta } from './jsonl.js';

export const DEFAULT_PROJECTS_ROOT = join(homedir(), '.claude', 'projects');

/** Cuántos bytes del inicio de cada .jsonl leemos para sacar id/cwd/title. */
const HEAD_BYTES = 64 * 1024;
/** Máximo de archivos leídos a la vez (evita picos de CPU/IO al arrancar). */
const SCAN_CONCURRENCY = 8;

export interface DiscoveredSession {
  id: string;
  cwd: string;
  project: string;
  title: string;
  updatedAt: string;
}

export function projectLabel(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean);
  return parts.slice(-2).join('/') || cwd;
}

const parseCache = new Map<string, { mtimeMs: number; meta: SessionMeta }>();

/** Lee solo los primeros `HEAD_BYTES` de un archivo (id/cwd/title viven ahí). */
async function readHead(filePath: string): Promise<string> {
  const handle = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
    return buf.toString('utf8', 0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Ejecuta `worker` sobre `items` con como mucho `limit` en paralelo. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function scanProjects(root = DEFAULT_PROJECTS_ROOT): Promise<DiscoveredSession[]> {
  let projectDirs: string[];
  try {
    projectDirs = await readdir(root);
  } catch {
    return [];
  }

  // Recolecta todos los .jsonl con su carpeta, y procésalos con concurrencia
  // acotada leyendo solo la cabecera de cada uno.
  const targets: { dir: string; filePath: string; file: string }[] = [];
  for (const dir of projectDirs) {
    const dirPath = join(root, dir);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      targets.push({ dir, filePath: join(dirPath, file), file });
    }
  }

  const scanned = await mapPool(targets, SCAN_CONCURRENCY, async ({ dir, filePath, file }) => {
    let info;
    try {
      info = await stat(filePath);
    } catch {
      return null;
    }
    if (!info.isFile()) return null;

    const cached = parseCache.get(filePath);
    let meta: SessionMeta;
    if (cached && cached.mtimeMs === info.mtimeMs) {
      meta = cached.meta;
    } else {
      try {
        meta = parseSessionMeta(await readHead(filePath));
      } catch {
        return null;
      }
      parseCache.set(filePath, { mtimeMs: info.mtimeMs, meta });
    }

    const id = meta.id ?? basename(file, '.jsonl');
    const cwd = meta.cwd ?? '';
    return {
      id,
      cwd,
      project: cwd ? projectLabel(cwd) : dir,
      title: meta.title ?? id,
      updatedAt: info.mtime.toISOString(),
    } satisfies DiscoveredSession;
  });

  const sessions = scanned.filter((s): s is DiscoveredSession => s !== null);
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sessions;
}

export async function findSessionFile(
  id: string,
  root = DEFAULT_PROJECTS_ROOT,
): Promise<string | null> {
  let dirs: string[];
  try {
    dirs = await readdir(root);
  } catch {
    return null;
  }
  for (const dir of dirs) {
    const candidate = join(root, dir, `${id}.jsonl`);
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // no está en este proyecto
    }
  }
  return null;
}
