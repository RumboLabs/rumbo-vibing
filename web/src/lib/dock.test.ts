import { describe, it, expect } from 'vitest';
import { reconcilePanels } from './dock';

describe('reconcilePanels', () => {
  it('sin paneles previos, añade todas las sesiones abiertas en orden', () => {
    expect(reconcilePanels(['a', 'b'], [])).toEqual({ toAdd: ['a', 'b'], toRemove: [] });
  });

  it('elimina paneles cuya sesión ya no está abierta', () => {
    expect(reconcilePanels(['a'], ['a', 'b'])).toEqual({ toAdd: [], toRemove: ['b'] });
  });

  it('añade las nuevas y elimina las que sobran a la vez', () => {
    expect(reconcilePanels(['a', 'c'], ['a', 'b'])).toEqual({
      toAdd: ['c'],
      toRemove: ['b'],
    });
  });

  it('sin cambios cuando coinciden', () => {
    expect(reconcilePanels(['a', 'b'], ['b', 'a'])).toEqual({ toAdd: [], toRemove: [] });
  });

  it('todo vacío => sin cambios', () => {
    expect(reconcilePanels([], [])).toEqual({ toAdd: [], toRemove: [] });
  });
});
