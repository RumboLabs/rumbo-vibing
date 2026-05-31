import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSessionFile, parseSessionMeta } from '../src/jsonl.js';

describe('parseSessionFile', () => {
  it('extrae id, cwd y título del .jsonl de muestra', () => {
    const parsed = parseSessionFile(
      readFileSync(
        join(import.meta.dirname, 'fixtures/sample-session.jsonl'),
        'utf8',
      ),
    );
    expect(parsed.id).toBe('test-uuid-1');
    expect(parsed.cwd).toBe('/home/u/proj');
    expect(parsed.title).toBe('Saludo inicial');
    expect(parsed.transcript.length).toBeGreaterThanOrEqual(2);
  });

  it('usa el primer prompt de usuario como título si no hay ai-title', () => {
    const parsed = parseSessionFile(
      '{"type":"user","sessionId":"s","cwd":"/c","message":{"role":"user","content":"primera idea"}}',
    );
    expect(parsed.title).toBe('primera idea');
  });

  it('tolera líneas mal formadas sin lanzar', () => {
    expect(() => parseSessionFile('not json\n{"type":"user"}')).not.toThrow();
  });

  it('parsea la línea válida aunque otra línea esté mal formada', () => {
    const parsed = parseSessionFile(
      'not json\n{"type":"user","sessionId":"x","message":{"role":"user","content":"hi"}}',
    );
    expect(parsed.id).toBe('x');
    expect(parsed.transcript).toHaveLength(1);
  });
});

describe('parseSessionMeta', () => {
  it('extrae id, cwd y title (ai-title) aunque el ai-title llegue tras el primer user', () => {
    const text = [
      JSON.stringify({ sessionId: 'abc', cwd: '/home/u/proj', type: 'user', message: { role: 'user', content: 'hola' } }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Mi título' }),
    ].join('\n');
    expect(parseSessionMeta(text)).toEqual({ id: 'abc', cwd: '/home/u/proj', title: 'Mi título' });
  });

  it('usa el primer prompt de usuario como title si no hay ai-title', () => {
    const text = JSON.stringify({
      type: 'user',
      sessionId: 'x',
      cwd: '/c',
      message: { role: 'user', content: 'primer prompt' },
    });
    expect(parseSessionMeta(text)).toEqual({ id: 'x', cwd: '/c', title: 'primer prompt' });
  });

  it('coincide con parseSessionFile en el fixture de muestra', () => {
    const text = readFileSync(
      join(import.meta.dirname, 'fixtures/sample-session.jsonl'),
      'utf8',
    );
    const meta = parseSessionMeta(text);
    const full = parseSessionFile(text);
    expect(meta).toEqual({ id: full.id, cwd: full.cwd, title: full.title });
  });

  it('devuelve null en los campos ausentes', () => {
    expect(parseSessionMeta('')).toEqual({ id: null, cwd: null, title: null });
  });
});
