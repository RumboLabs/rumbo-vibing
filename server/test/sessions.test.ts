import { describe, it, expect } from 'vitest';
import { filterDiscoveredByWorkspaces, buildSessions } from '../src/sessions.js';
import type { DiscoveredSession } from '../src/discovery.js';

function d(id: string, cwd: string): DiscoveredSession {
  return { id, cwd, project: id, title: id, updatedAt: '2026-01-01T00:00:00.000Z' };
}

describe('filterDiscoveredByWorkspaces', () => {
  const sessions = [
    d('a', '/home/u/proj'),
    d('b', '/home/u/proj/sub'),
    d('c', '/home/u/otro'),
    d('d', '/var/tmp/x'),
  ];

  it('lista de workspaces vacía => resultado vacío', () => {
    expect(filterDiscoveredByWorkspaces(sessions, [])).toEqual([]);
  });

  it('conserva solo coincidencias exactas, no descendientes', () => {
    const res = filterDiscoveredByWorkspaces(sessions, ['/home/u/proj']);
    expect(res.map((s) => s.id)).toEqual(['a']);
  });

  it('descarta subcarpetas y worktrees (no son match exacto)', () => {
    const withWorktree = [
      d('a', '/home/u/proj'),
      d('w', '/home/u/proj/.worktrees/rumbo/uuid'),
      d('s', '/home/u/proj/server'),
    ];
    const res = filterDiscoveredByWorkspaces(withWorktree, ['/home/u/proj']);
    expect(res.map((s) => s.id)).toEqual(['a']);
  });

  it('descarta las sesiones fuera de los workspaces', () => {
    const res = filterDiscoveredByWorkspaces(sessions, ['/home/u/otro']);
    expect(res.map((s) => s.id)).toEqual(['c']);
  });

  it('admite varios workspaces', () => {
    const res = filterDiscoveredByWorkspaces(sessions, ['/home/u/otro', '/var/tmp/x']);
    expect(res.map((s) => s.id)).toEqual(['c', 'd']);
  });
});

describe('buildSessions', () => {
  const NOW = '2026-05-30T00:00:00.000Z';

  it('marca como en vivo una sesión descubierta cuyo id está en tmux', () => {
    const live = new Map([['a', { paneText: 'esc to interrupt', cwd: '/ws' }]]);
    const res = buildSessions([d('a', '/ws')], ['/ws'], live, NOW);
    expect(res).toHaveLength(1);
    expect(res[0].tmuxName).toBe('a');
    expect(res[0].status).toBe('working');
    expect(res[0].updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('una sesión descubierta sin tmux queda idle y sin tmuxName', () => {
    const res = buildSessions([d('a', '/ws')], ['/ws'], new Map(), NOW);
    expect(res[0].tmuxName).toBeNull();
    expect(res[0].status).toBe('idle');
  });

  it('descarta descubiertas fuera del workspace', () => {
    const res = buildSessions([d('a', '/otro')], ['/ws'], new Map(), NOW);
    expect(res).toEqual([]);
  });

  it('expone sesiones tmux nuevas (no descubiertas) dentro de un workspace', () => {
    const live = new Map([['new', { paneText: '? for shortcuts', cwd: '/ws' }]]);
    const res = buildSessions([], ['/ws'], live, NOW);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('new');
    expect(res[0].tmuxName).toBe('new');
    expect(res[0].cwd).toBe('/ws');
    expect(res[0].status).toBe('waiting');
    expect(res[0].updatedAt).toBe(NOW);
  });

  it('descarta sesiones tmux nuevas cuyo cwd no es un workspace', () => {
    const live = new Map([['new', { paneText: null, cwd: '/ws/.worktrees/x' }]]);
    const res = buildSessions([], ['/ws'], live, NOW);
    expect(res).toEqual([]);
  });

  it('no duplica una sesión que está descubierta y en tmux', () => {
    const live = new Map([['a', { paneText: null, cwd: '/ws' }]]);
    const res = buildSessions([d('a', '/ws')], ['/ws'], live, NOW);
    expect(res).toHaveLength(1);
  });
});
