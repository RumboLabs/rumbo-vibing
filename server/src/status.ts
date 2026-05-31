import type { SessionStatus } from './types.js';

/** Marcadores que la TUI de Claude muestra mientras genera una respuesta. */
const WORKING_MARKERS = ['esc to interrupt', 'esc para interrumpir'];

export interface StatusInput {
  tmuxExists: boolean;
  paneText: string | null;
}

export function computeStatus(input: StatusInput): SessionStatus {
  if (!input.tmuxExists) return 'idle';
  const text = (input.paneText ?? '').toLowerCase();
  if (WORKING_MARKERS.some((marker) => text.includes(marker))) return 'working';
  return 'waiting';
}
