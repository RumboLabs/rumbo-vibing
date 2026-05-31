export type SessionStatus = 'working' | 'waiting' | 'idle' | 'dead' | 'readonly';

export interface Session {
  /** UUID de sesión de Claude (= nombre del archivo .jsonl). */
  id: string;
  /** Directorio de trabajo de la sesión. */
  cwd: string;
  /** Etiqueta legible del proyecto. */
  project: string;
  /** Título de la sesión (ai-title o primer prompt). */
  title: string;
  status: SessionStatus;
  /**
   * Id de la sesión cuando hay un proceso vivo en el backend, o null si no.
   * (Nombre heredado de la época de tmux; el frontend lo usa para conectar el
   * terminal a /ws/pty/<tmuxName>.)
   */
  tmuxName: string | null;
  /** ISO timestamp de la última modificación del .jsonl. */
  updatedAt: string;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string | null;
}
