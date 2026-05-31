import { spawn as ptySpawn } from 'node-pty';
import { RingBuffer } from './ring-buffer.js';

/** Subconjunto de node-pty que usamos (permite inyectar un falso en tests). */
export interface PtyLike {
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: () => void): { dispose(): void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

export interface SpawnOptions {
  id: string;
  cwd: string;
  model?: string;
  name?: string;
  resume?: boolean;
}

export type SpawnFn = (opts: SpawnOptions) => PtyLike;

type Subscriber = (data: string) => void;

interface ManagedProcess {
  pty: PtyLike;
  cwd: string;
  buffer: RingBuffer;
  subscribers: Set<Subscriber>;
}

const MAX_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MB

function defaultSpawn(opts: SpawnOptions): PtyLike {
  const args = opts.resume
    ? ['--resume', opts.id]
    : ['--session-id', opts.id];
  if (!opts.resume) {
    if (opts.name) args.push('--name', opts.name);
    if (opts.model) args.push('--model', opts.model);
  }
  return ptySpawn('claude', args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: opts.cwd,
    env: process.env as Record<string, string>,
  }) as unknown as PtyLike;
}

export class ProcessManager {
  private procs = new Map<string, ManagedProcess>();
  private spawnFn: SpawnFn;
  private maxBufferBytes: number;

  constructor(opts?: { spawn?: SpawnFn; maxBufferBytes?: number }) {
    this.spawnFn = opts?.spawn ?? defaultSpawn;
    this.maxBufferBytes = opts?.maxBufferBytes ?? MAX_BUFFER_BYTES;
  }

  spawn(opts: SpawnOptions): void {
    this.kill(opts.id);
    const pty = this.spawnFn(opts);
    const proc: ManagedProcess = {
      pty,
      cwd: opts.cwd,
      buffer: new RingBuffer(this.maxBufferBytes),
      subscribers: new Set(),
    };
    pty.onData((data) => {
      proc.buffer.append(data);
      for (const sub of proc.subscribers) sub(data);
    });
    pty.onExit(() => {
      // Solo elimina si el Map sigue apuntando a ESTE proceso. Evita que el
      // onExit (asíncrono) de un proceso anterior matado en un re-spawn con el
      // mismo id borre del Map al proceso nuevo recién registrado.
      if (this.procs.get(opts.id) === proc) {
        this.procs.delete(opts.id);
      }
    });
    this.procs.set(opts.id, proc);
  }

  resume(opts: { id: string; cwd: string }): void {
    this.spawn({ id: opts.id, cwd: opts.cwd, resume: true });
  }

  get(id: string): ManagedProcess | undefined {
    return this.procs.get(id);
  }

  liveIds(): string[] {
    return [...this.procs.keys()];
  }

  liveSnapshot(): Map<string, { cwd: string; recentText: string }> {
    const out = new Map<string, { cwd: string; recentText: string }>();
    for (const [id, proc] of this.procs) {
      out.set(id, { cwd: proc.cwd, recentText: proc.buffer.recentText(4000) });
    }
    return out;
  }

  write(id: string, data: string): void {
    this.procs.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.procs.get(id)?.pty.resize(cols, rows);
  }

  kill(id: string): void {
    const proc = this.procs.get(id);
    if (!proc) return;
    try {
      proc.pty.kill();
    } catch {
      /* ya estaba muerto */
    }
    this.procs.delete(id);
  }

  subscribe(id: string, sub: Subscriber): () => void {
    const proc = this.procs.get(id);
    if (!proc) return () => {};
    const replay = proc.buffer.snapshot();
    if (replay) sub(replay);
    proc.subscribers.add(sub);
    return () => proc.subscribers.delete(sub);
  }
}
