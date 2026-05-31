import { describe, it, expect } from 'vitest';
import { ProcessManager, type PtyLike, type SpawnFn } from '../src/process-manager.js';

/** pty falso: capturamos lo escrito y permitimos emitir datos/salida. */
function makeFakePty(): PtyLike & { emit: (d: string) => void; exit: () => void; written: string[] } {
  let onData: (d: string) => void = () => {};
  let onExit: () => void = () => {};
  const written: string[] = [];
  return {
    written,
    onData: (cb) => { onData = cb; return { dispose() {} }; },
    onExit: (cb) => { onExit = cb; return { dispose() {} }; },
    write: (d) => { written.push(d); },
    resize: () => {},
    kill: () => { onExit(); },
    emit: (d) => onData(d),
    exit: () => onExit(),
  };
}

function managerWithFake() {
  const fakes: ReturnType<typeof makeFakePty>[] = [];
  const spawn: SpawnFn = () => {
    const f = makeFakePty();
    fakes.push(f);
    return f;
  };
  return { pm: new ProcessManager({ spawn, maxBufferBytes: 1000 }), fakes };
}

describe('ProcessManager', () => {
  it('spawn registra un proceso vivo', () => {
    const { pm } = managerWithFake();
    pm.spawn({ id: 'a', cwd: '/tmp' });
    expect(pm.liveIds()).toEqual(['a']);
    expect(pm.get('a')).toBeDefined();
  });

  it('acumula la salida en el buffer y la reproduce a un nuevo suscriptor', () => {
    const { pm, fakes } = managerWithFake();
    pm.spawn({ id: 'a', cwd: '/tmp' });
    fakes[0].emit('hola');
    const received: string[] = [];
    pm.subscribe('a', (d) => received.push(d));
    expect(received.join('')).toBe('hola');
    fakes[0].emit(' mundo');
    expect(received.join('')).toBe('hola mundo');
  });

  it('write reenvía al pty', () => {
    const { pm, fakes } = managerWithFake();
    pm.spawn({ id: 'a', cwd: '/tmp' });
    pm.write('a', 'ls\n');
    expect(fakes[0].written).toContain('ls\n');
  });

  it('kill termina el proceso y deja de estar vivo', () => {
    const { pm } = managerWithFake();
    pm.spawn({ id: 'a', cwd: '/tmp' });
    pm.kill('a');
    expect(pm.liveIds()).toEqual([]);
    expect(pm.get('a')).toBeUndefined();
  });

  it('al salir el proceso por sí mismo, deja de estar vivo', () => {
    const { pm, fakes } = managerWithFake();
    pm.spawn({ id: 'a', cwd: '/tmp' });
    fakes[0].exit();
    expect(pm.liveIds()).toEqual([]);
  });

  it('liveSnapshot expone cwd y texto reciente por id vivo', () => {
    const { pm, fakes } = managerWithFake();
    pm.spawn({ id: 'a', cwd: '/tmp/x' });
    fakes[0].emit('esc to interrupt');
    const snap = pm.liveSnapshot();
    expect(snap.get('a')?.cwd).toBe('/tmp/x');
    expect(snap.get('a')?.recentText).toContain('esc to interrupt');
  });
});
