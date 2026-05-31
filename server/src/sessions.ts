import { scanProjects, projectLabel, type DiscoveredSession } from './discovery.js';
import { computeStatus } from './status.js';
import type { Session } from './types.js';
import type { ProcessManager } from './process-manager.js';
import { getWorkspaces } from './config.js';

/**
 * Conserva solo las sesiones cuyo `cwd` coincide EXACTAMENTE con un workspace
 * configurado. El match exacto deja fuera worktrees, subcarpetas (server, web,
 * apps/*) y node_modules: para ver un repo se añade su raíz como workspace.
 */
export function filterDiscoveredByWorkspaces(
  discovered: DiscoveredSession[],
  workspaces: string[],
): DiscoveredSession[] {
  const allowed = new Set(workspaces);
  return discovered.filter((d) => allowed.has(d.cwd));
}

/** Estado en vivo de una sesión con proceso activo en el backend. */
export interface LiveSession {
  /** Última porción de salida del proceso (para la heurística de estado). */
  paneText: string | null;
  cwd: string;
}

/**
 * Combina las sesiones descubiertas (.jsonl) con las que tienen proceso vivo en
 * el backend para producir la lista que ve el frontend. `live` está indexado por
 * id de sesión.
 *
 * - Una sesión descubierta dentro de un workspace se muestra; si además tiene
 *   proceso vivo se marca con `tmuxName` (= id) y su estado se calcula de la
 *   salida reciente.
 * - Una sesión viva todavía no descubierta (recién creada, sin .jsonl) se expone
 *   si su `cwd` cae dentro de un workspace, para que aparezca al instante.
 */
export function buildSessions(
  discovered: DiscoveredSession[],
  workspaces: string[],
  live: Map<string, LiveSession>,
  now: string,
): Session[] {
  const allowed = new Set(workspaces);
  const merged: Session[] = [];
  const seen = new Set<string>();

  for (const d of filterDiscoveredByWorkspaces(discovered, workspaces)) {
    const info = live.get(d.id);
    const tmuxExists = info !== undefined;
    merged.push({
      id: d.id,
      cwd: d.cwd,
      project: d.project,
      title: d.title,
      tmuxName: tmuxExists ? d.id : null,
      status: computeStatus({ tmuxExists, paneText: info?.paneText ?? null }),
      updatedAt: d.updatedAt,
    });
    seen.add(d.id);
  }

  for (const [id, info] of live) {
    if (seen.has(id)) continue;
    if (!allowed.has(info.cwd)) continue;
    merged.push({
      id,
      cwd: info.cwd,
      project: projectLabel(info.cwd),
      title: id,
      tmuxName: id,
      status: computeStatus({ tmuxExists: true, paneText: info.paneText }),
      updatedAt: now,
    });
  }

  return merged;
}

type Listener = (sessions: Session[]) => void;

export class SessionRegistry {
  private sessions: Session[] = [];
  private discovered: DiscoveredSession[] = [];
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticks = 0;

  constructor(private readonly pm: ProcessManager) {}

  async start(): Promise<void> {
    await this.rediscover();
    await this.refresh();
    this.timer = setInterval(() => {
      this.ticks += 1;
      const job = this.ticks % 8 === 0
        ? this.rediscover().then(() => this.refresh())
        : this.refresh();
      void job.catch((err) => console.error('refresh fallido:', err));
    }, 2000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getSessions(): Session[] {
    return this.sessions;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.sessions);
    return () => this.listeners.delete(listener);
  }

  private async rediscover(): Promise<void> {
    this.discovered = await scanProjects();
  }

  private async refresh(): Promise<void> {
    const workspaces = await getWorkspaces();
    const live = new Map<string, LiveSession>();
    for (const [id, snap] of this.pm.liveSnapshot()) {
      live.set(id, { paneText: snap.recentText, cwd: snap.cwd });
    }
    const merged = buildSessions(this.discovered, workspaces, live, new Date().toISOString());
    this.sessions = merged;
    for (const listener of this.listeners) listener(merged);
  }
}
