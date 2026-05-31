import type { TranscriptEntry } from './types.js';

export interface ParsedSession {
  id: string | null;
  cwd: string | null;
  title: string | null;
  transcript: TranscriptEntry[];
}

function blockText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
          const text = (block as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return '';
}

/** Solo los metadatos de cabecera de una sesión (id, cwd, title). */
export interface SessionMeta {
  id: string | null;
  cwd: string | null;
  title: string | null;
}

/**
 * Extrae id/cwd/title recorriendo las líneas y parando en cuanto los tiene
 * todos. No construye el transcript, así que es barato aunque `content` sea solo
 * el principio de un .jsonl enorme (discovery lee solo la cabecera). Sigue el
 * mismo formato que parseSessionFile: id=sessionId, title=aiTitle o, si no, el
 * primer mensaje de usuario.
 */
export function parseSessionMeta(content: string): SessionMeta {
  let id: string | null = null;
  let cwd: string | null = null;
  let title: string | null = null;
  let firstUserText: string | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue; // tolera la última línea a medio escribir
    }

    if (typeof entry.sessionId === 'string' && !id) id = entry.sessionId;
    if (typeof entry.cwd === 'string' && !cwd) cwd = entry.cwd;
    if (entry.type === 'ai-title' && typeof entry.aiTitle === 'string') {
      title = entry.aiTitle;
    }
    if (firstUserText === null && entry.type === 'user') {
      const message = entry.message as { content?: unknown } | undefined;
      if (message) {
        const text = blockText(message.content).trim();
        if (text) firstUserText = text;
      }
    }
    // Para en cuanto tiene id, cwd y un ai-title explícito (lo más fiable). No
    // cortamos solo con firstUserText: un ai-title posterior debe ganar, igual
    // que en parseSessionFile.
    if (id && cwd && title) break;
  }

  if (!title && firstUserText) title = firstUserText.slice(0, 80);
  return { id, cwd, title };
}

export function parseSessionFile(content: string): ParsedSession {
  const result: ParsedSession = { id: null, cwd: null, title: null, transcript: [] };
  let firstUserText: string | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue; // tolera la última línea a medio escribir
    }

    if (typeof entry.sessionId === 'string' && !result.id) result.id = entry.sessionId;
    if (typeof entry.cwd === 'string' && !result.cwd) result.cwd = entry.cwd;
    if (entry.type === 'ai-title' && typeof entry.aiTitle === 'string') {
      result.title = entry.aiTitle;
    }

    if (entry.type === 'user' || entry.type === 'assistant') {
      const message = entry.message as { role?: string; content?: unknown } | undefined;
      if (!message) continue;
      const text = blockText(message.content).trim();
      if (!text) continue;
      const role: 'user' | 'assistant' = entry.type === 'assistant' ? 'assistant' : 'user';
      result.transcript.push({
        role,
        text,
        timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : null,
      });
      if (role === 'user' && firstUserText === null) firstUserText = text;
    }
  }

  if (!result.title && firstUserText) {
    result.title = firstUserText.slice(0, 80);
  }
  return result;
}
