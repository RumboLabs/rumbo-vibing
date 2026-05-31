import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseSessionFile } from './jsonl.js';
import { scanProjects, findSessionFile } from './discovery.js';
import type { SessionRegistry } from './sessions.js';
import type { ProcessManager } from './process-manager.js';
import { getWorkspaceConfigs, setWorkspaceConfigs } from './config.js';
import { paginateSessions } from './pagination.js';

const run = promisify(execFile);

const SESSION_ID_RE = /^[0-9a-fA-F-]{36}$/;

export function createApiRouter(registry: SessionRegistry, pm: ProcessManager): Router {
  const router = Router();

  router.get('/sessions', (_req, res) => {
    res.json(registry.getSessions());
  });

  router.get('/sessions/page', (req, res) => {
    const { project, search, offset, limit } = req.query as Record<string, string | undefined>;
    const result = paginateSessions(registry.getSessions(), {
      project: typeof project === 'string' ? project : undefined,
      search: typeof search === 'string' ? search : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
    res.json(result);
  });

  router.get('/sessions/:id/transcript', async (req, res) => {
    if (!SESSION_ID_RE.test(req.params.id)) {
      res.status(400).json({ error: 'id de sesión inválido' });
      return;
    }
    const path = await findSessionFile(req.params.id);
    if (!path) {
      res.status(404).json({ error: 'sesión no encontrada' });
      return;
    }
    const parsed = parseSessionFile(await readFile(path, 'utf8'));
    res.json(parsed.transcript);
  });

  router.post('/sessions', (req, res) => {
    const { cwd, model, name } = (req.body ?? {}) as {
      cwd?: unknown; model?: unknown; name?: unknown;
    };
    if (typeof cwd !== 'string' || !cwd) {
      res.status(400).json({ error: 'cwd requerido' });
      return;
    }
    const id = randomUUID();
    try {
      pm.spawn({
        id,
        cwd,
        model: typeof model === 'string' && model ? model : undefined,
        name: typeof name === 'string' && name ? name : undefined,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
      return;
    }
    res.json({ id });
  });

  router.post('/sessions/:id/resume', (req, res) => {
    if (!SESSION_ID_RE.test(req.params.id)) {
      res.status(400).json({ error: 'id de sesión inválido' });
      return;
    }
    const id = req.params.id;
    if (pm.get(id)) {
      res.json({ ok: true });
      return;
    }
    const session = registry.getSessions().find((s) => s.id === id);
    const cwd = session?.cwd || process.env.HOME || '/';
    try {
      pm.resume({ id, cwd });
    } catch (err) {
      res.status(500).json({ error: String(err) });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/sessions/:id/kill', (req, res) => {
    if (!SESSION_ID_RE.test(req.params.id)) {
      res.status(400).json({ error: 'id de sesión inválido' });
      return;
    }
    pm.kill(req.params.id);
    res.json({ ok: true });
  });

  router.get('/workspaces', async (_req, res) => {
    const discovered = await scanProjects();
    const available = [
      ...new Set(
        discovered
          .map((s) => s.cwd)
          .filter((cwd) => cwd && !cwd.includes('/.claude/') && !cwd.includes('/.worktrees/')),
      ),
    ].sort();
    const selected = await getWorkspaceConfigs();
    res.json({ available, selected });
  });

  router.post('/workspaces/open-in-vscode', async (req, res) => {
    const { path } = (req.body ?? {}) as { path?: unknown };
    if (typeof path !== 'string' || !path) {
      res.status(400).json({ error: 'path requerido' });
      return;
    }
    // Rechaza rutas que parezcan flags para evitar argument injection.
    if (path.startsWith('-')) {
      res.status(400).json({ error: 'path inválido' });
      return;
    }
    // Solo se permite abrir rutas que son workspaces configurados.
    const allowed = (await getWorkspaceConfigs()).some((w) => w.path === path);
    if (!allowed) {
      res.status(403).json({ error: 'path no es un workspace configurado' });
      return;
    }
    try {
      // `--` fuerza a tratar el valor como ruta posicional, no como opción.
      await run('code', ['--', path]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.put('/workspaces', async (req, res) => {
    const { workspaces } = (req.body ?? {}) as { workspaces?: unknown };
    if (!Array.isArray(workspaces)) {
      res.status(400).json({ error: 'workspaces debe ser un array' });
      return;
    }
    try {
      await setWorkspaceConfigs(workspaces);
    } catch (err) {
      res.status(500).json({ error: String(err) });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
