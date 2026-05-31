import type { Session } from './types.js';

export interface PageParams {
  project?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface PageResult {
  items: Session[];
  total: number;
  offset: number;
  limit: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizeInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

export function paginateSessions(sessions: Session[], params: PageParams): PageResult {
  const offset = normalizeInt(params.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = normalizeInt(params.limit, DEFAULT_LIMIT, 0, MAX_LIMIT);
  const search = params.search?.trim().toLowerCase() ?? '';

  let filtered = sessions;
  if (params.project !== undefined) {
    filtered = filtered.filter((s) => s.project === params.project);
  }
  if (search) {
    filtered = filtered.filter((s) =>
      `${s.title} ${s.project}`.toLowerCase().includes(search),
    );
  }

  const sorted = [...filtered].sort((a, b) =>
    a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0,
  );
  const total = sorted.length;
  const items = sorted.slice(offset, offset + limit);

  return { items, total, offset, limit };
}
