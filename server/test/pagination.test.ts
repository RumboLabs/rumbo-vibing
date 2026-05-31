import { describe, it, expect } from 'vitest';
import { paginateSessions } from '../src/pagination.js';
import type { Session } from '../src/types.js';

function s(partial: Partial<Session> & { id: string }): Session {
  return {
    id: partial.id,
    cwd: partial.cwd ?? '',
    project: partial.project ?? 'proj',
    title: partial.title ?? partial.id,
    status: partial.status ?? 'idle',
    tmuxName: partial.tmuxName ?? null,
    updatedAt: partial.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

const sessions: Session[] = [
  s({ id: 'a', project: 'alpha', title: 'login fix', updatedAt: '2026-05-01T10:00:00.000Z' }),
  s({ id: 'b', project: 'alpha', title: 'refactor api', updatedAt: '2026-05-10T10:00:00.000Z' }),
  s({ id: 'c', project: 'beta', title: 'login beta', updatedAt: '2026-05-05T10:00:00.000Z' }),
];

describe('paginateSessions', () => {
  it('ordena por updatedAt descendente', () => {
    const res = paginateSessions(sessions, {});
    expect(res.items.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(res.total).toBe(3);
  });

  it('filtra por proyecto exacto', () => {
    const res = paginateSessions(sessions, { project: 'alpha' });
    expect(res.items.map((x) => x.id)).toEqual(['b', 'a']);
    expect(res.total).toBe(2);
  });

  it('filtra por búsqueda en título y proyecto (case-insensitive)', () => {
    const res = paginateSessions(sessions, { search: 'LOGIN' });
    expect(res.items.map((x) => x.id)).toEqual(['c', 'a']);
    expect(res.total).toBe(2);
  });

  it('aplica offset y limit sobre el total filtrado', () => {
    const res = paginateSessions(sessions, { offset: 1, limit: 1 });
    expect(res.items.map((x) => x.id)).toEqual(['c']);
    expect(res.total).toBe(3);
    expect(res.offset).toBe(1);
    expect(res.limit).toBe(1);
  });

  it('clampa limit al máximo y offset/limit inválidos a sus defaults', () => {
    const res = paginateSessions(sessions, { offset: -5, limit: 999 });
    expect(res.offset).toBe(0);
    expect(res.limit).toBe(100);
    expect(res.items).toHaveLength(3);
  });

  it('filtra proyecto vacío de forma exacta', () => {
    const withEmpty = [...sessions, s({ id: 'd', project: '', title: 'huérfana' })];
    const res = paginateSessions(withEmpty, { project: '' });
    expect(res.items.map((x) => x.id)).toEqual(['d']);
    expect(res.total).toBe(1);
  });
});
