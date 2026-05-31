import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/ring-buffer.js';

describe('RingBuffer', () => {
  it('acumula y devuelve lo escrito si no supera el máximo', () => {
    const buf = new RingBuffer(100);
    buf.append('hola ');
    buf.append('mundo');
    expect(buf.snapshot()).toBe('hola mundo');
  });

  it('recorta por el principio cuando supera el máximo (por bytes)', () => {
    const buf = new RingBuffer(5);
    buf.append('abcdefgh'); // 8 bytes > 5
    expect(buf.snapshot()).toBe('defgh');
  });

  it('recorta de forma incremental entre appends', () => {
    const buf = new RingBuffer(4);
    buf.append('abc');
    buf.append('de'); // total 'abcde' (5) -> recorta a 'bcde'
    expect(buf.snapshot()).toBe('bcde');
  });

  it('un append mayor que el máximo conserva solo la cola', () => {
    const buf = new RingBuffer(3);
    buf.append('abcdef');
    expect(buf.snapshot()).toBe('def');
  });

  it('recentText devuelve como mucho los últimos N caracteres', () => {
    const buf = new RingBuffer(100);
    buf.append('linea1\nlinea2\nlinea3');
    expect(buf.recentText(6)).toBe('linea3');
  });
});
