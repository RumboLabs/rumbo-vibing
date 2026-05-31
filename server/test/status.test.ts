import { describe, it, expect } from 'vitest';
import { computeStatus } from '../src/status.js';

describe('computeStatus', () => {
  it('idle cuando no hay sesión tmux', () => {
    expect(computeStatus({ tmuxExists: false, paneText: null })).toBe('idle');
  });

  it('working cuando el panel muestra el indicador de interrupción', () => {
    expect(
      computeStatus({ tmuxExists: true, paneText: 'Pensando… (esc to interrupt)' }),
    ).toBe('working');
  });

  it('waiting cuando hay sesión pero no está generando', () => {
    expect(
      computeStatus({ tmuxExists: true, paneText: '> escribe tu mensaje' }),
    ).toBe('waiting');
  });
});
