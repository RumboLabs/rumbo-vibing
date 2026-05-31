import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getWorkspaces,
  getWorkspaceConfigs,
  setWorkspaceConfigs,
} from '../src/config.js';

let dir: string;
let configPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cc-config-'));
  configPath = join(dir, 'sessions-web-ui.json');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('getWorkspaceConfigs', () => {
  it('devuelve [] si el archivo no existe', async () => {
    expect(await getWorkspaceConfigs(configPath)).toEqual([]);
  });

  it('devuelve [] si el archivo está corrupto', async () => {
    await writeFile(configPath, 'no es json', 'utf8');
    expect(await getWorkspaceConfigs(configPath)).toEqual([]);
  });

  it('devuelve [] si el campo workspaces no es un array', async () => {
    await writeFile(configPath, JSON.stringify({ workspaces: 'no-array' }), 'utf8');
    expect(await getWorkspaceConfigs(configPath)).toEqual([]);
  });

  it('migra el formato antiguo (array de strings) a objetos', async () => {
    await writeFile(configPath, JSON.stringify({ workspaces: ['/home/u/a', '/home/u/b'] }), 'utf8');
    expect(await getWorkspaceConfigs(configPath)).toEqual([
      { path: '/home/u/a' },
      { path: '/home/u/b' },
    ]);
  });
});

describe('setWorkspaceConfigs + getWorkspaceConfigs', () => {
  it('escribe y vuelve a leer rutas con y sin label', async () => {
    await setWorkspaceConfigs(
      [{ path: '/home/u/a', label: 'App' }, { path: '/home/u/b' }],
      configPath,
    );
    expect(await getWorkspaceConfigs(configPath)).toEqual([
      { path: '/home/u/a', label: 'App' },
      { path: '/home/u/b' },
    ]);
  });

  it('normaliza: trim de ruta y label, quita barra final, dedupe, descarta vacíos', async () => {
    await setWorkspaceConfigs(
      [
        { path: '  /x/y/  ', label: '  Mi label  ' },
        { path: '/x/y', label: 'duplicado ignorado' },
        { path: '', label: 'sin ruta' },
        { path: '/z', label: '' },
      ],
      configPath,
    );
    expect(await getWorkspaceConfigs(configPath)).toEqual([
      { path: '/x/y', label: 'Mi label' },
      { path: '/z' },
    ]);
  });

  it('acepta el formato antiguo de strings al escribir', async () => {
    await setWorkspaceConfigs(['/p', '/q'], configPath);
    expect(await getWorkspaceConfigs(configPath)).toEqual([{ path: '/p' }, { path: '/q' }]);
  });
});

describe('getWorkspaces (solo rutas)', () => {
  it('devuelve únicamente las rutas', async () => {
    await setWorkspaceConfigs([{ path: '/a', label: 'A' }, { path: '/b' }], configPath);
    expect(await getWorkspaces(configPath)).toEqual(['/a', '/b']);
  });
});
