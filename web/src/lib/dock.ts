/** Diferencia entre las sesiones abiertas y los paneles actuales de dockview. */
export interface PanelReconciliation {
  /** Ids de sesión abiertas que aún no tienen panel (en orden de apertura). */
  toAdd: string[];
  /** Ids de panel cuya sesión ya no está abierta. */
  toRemove: string[];
}

/**
 * Calcula qué paneles añadir y cuáles quitar para que el conjunto de paneles de
 * dockview coincida con las sesiones abiertas. El orden de `toAdd` respeta
 * `openIds`.
 */
export function reconcilePanels(openIds: string[], panelIds: string[]): PanelReconciliation {
  const open = new Set(openIds);
  const panels = new Set(panelIds);
  const toAdd = openIds.filter((id) => !panels.has(id));
  const toRemove = panelIds.filter((id) => !open.has(id));
  return { toAdd, toRemove };
}
