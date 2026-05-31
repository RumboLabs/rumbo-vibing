import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanProjects, findSessionFile } from '../src/discovery.js';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'cc-discovery-'));
  const projectDir = join(root, '-home-u-proj');
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(projectDir, 'sess-1.jsonl'),
    '{"type":"user","sessionId":"sess-1","cwd":"/home/u/proj","message":{"role":"user","content":"hola"}}\n' +
      '{"type":"ai-title","sessionId":"sess-1","aiTitle":"Mi sesión"}\n',
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('scanProjects', () => {
  it('descubre las sesiones y lee el cwd del contenido', async () => {
    const sessions = await scanProjects(root);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'sess-1',
      cwd: '/home/u/proj',
      project: 'u/proj',
      title: 'Mi sesión',
    });
    expect(typeof sessions[0].updatedAt).toBe('string');
  });

  it('devuelve [] si el directorio raíz no existe', async () => {
    expect(await scanProjects(join(root, 'no-existe'))).toEqual([]);
  });
});

describe('findSessionFile', () => {
  it('localiza el .jsonl por id', async () => {
    const path = await findSessionFile('sess-1', root);
    expect(path).toContain('sess-1.jsonl');
  });

  it('devuelve null si no existe', async () => {
    expect(await findSessionFile('desconocida', root)).toBeNull();
  });
});
