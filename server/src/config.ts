import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_CONFIG_PATH = join(homedir(), '.claude', 'sessions-web-ui.json');

/** Un workspace configurado: ruta y, opcionalmente, una etiqueta legible. */
export interface Workspace {
  path: string;
  label?: string;
}

/**
 * Normaliza la lista de workspaces aceptando el formato antiguo (array de
 * strings) y el nuevo (array de `{ path, label? }`). Limpia la ruta (trim, sin
 * barra final), deduplica por ruta, descarta vacíos y normaliza el label
 * (trim; vacío => sin label).
 */
function normalize(input: unknown): Workspace[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Workspace[] = [];
  for (const item of input) {
    let rawPath: unknown;
    let rawLabel: unknown;
    if (typeof item === 'string') {
      rawPath = item;
    } else if (item && typeof item === 'object') {
      rawPath = (item as { path?: unknown }).path;
      rawLabel = (item as { label?: unknown }).label;
    } else {
      continue;
    }
    if (typeof rawPath !== 'string') continue;
    const path = rawPath.trim().replace(/\/+$/, '');
    if (!path) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
    out.push(label ? { path, label } : { path });
  }
  return out;
}

/** Workspaces configurados con su etiqueta (si la tienen). */
export async function getWorkspaceConfigs(
  path: string = DEFAULT_CONFIG_PATH,
): Promise<Workspace[]> {
  try {
    const text = await readFile(path, 'utf8');
    const data = JSON.parse(text) as { workspaces?: unknown };
    return normalize(data.workspaces);
  } catch {
    return [];
  }
}

/** Solo las rutas de los workspaces configurados (para el filtrado de sesiones). */
export async function getWorkspaces(path: string = DEFAULT_CONFIG_PATH): Promise<string[]> {
  return (await getWorkspaceConfigs(path)).map((w) => w.path);
}

export async function setWorkspaceConfigs(
  workspaces: unknown,
  path: string = DEFAULT_CONFIG_PATH,
): Promise<void> {
  const normalized = normalize(workspaces);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ workspaces: normalized }, null, 2), 'utf8');
}
