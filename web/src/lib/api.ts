export type SessionStatus = 'working' | 'waiting' | 'idle' | 'dead' | 'readonly';

export interface Session {
  id: string;
  cwd: string;
  project: string;
  title: string;
  status: SessionStatus;
  tmuxName: string | null;
  updatedAt: string;
}

export interface SessionPage {
  items: Session[];
  total: number;
  offset: number;
  limit: number;
}

export interface Workspace {
  path: string;
  label?: string;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  listSessions: () => jsonFetch<Session[]>('/api/sessions'),
  listSessionsPage: (params: {
    project?: string;
    search?: string;
    offset?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.project !== undefined) qs.set('project', params.project);
    if (params.search) qs.set('search', params.search);
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    return jsonFetch<SessionPage>(`/api/sessions/page?${qs.toString()}`);
  },
  createSession: (body: { cwd: string; model?: string; name?: string }) =>
    jsonFetch<{ id: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resumeSession: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/sessions/${id}/resume`, {
      method: 'POST',
      body: '{}',
    }),
  killSession: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/sessions/${id}/kill`, {
      method: 'POST',
      body: '{}',
    }),
  getWorkspaces: () =>
    jsonFetch<{ available: string[]; selected: Workspace[] }>('/api/workspaces'),
  setWorkspaces: (workspaces: Workspace[]) =>
    jsonFetch<{ ok: boolean }>('/api/workspaces', {
      method: 'PUT',
      body: JSON.stringify({ workspaces }),
    }),
  openInVscode: (path: string) =>
    jsonFetch<{ ok: boolean }>('/api/workspaces/open-in-vscode', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
};
