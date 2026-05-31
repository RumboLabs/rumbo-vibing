import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface WorkspacesPanelProps {
  /** Se llama tras guardar correctamente. */
  onSaved?: () => void;
}

/**
 * Editor de workspaces (rutas a mostrar + etiqueta opcional). Carga la lista al
 * montar y guarda en el backend. Pensado para usarse dentro de la página de
 * configuración.
 */
export function WorkspacesPanel({ onSaved }: WorkspacesPanelProps) {
  const [available, setAvailable] = useState<string[]>([]);
  // path -> label ('' = sin label). Las claves son los workspaces seleccionados.
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .getWorkspaces()
      .then((data) => {
        setAvailable(data.available);
        setSelected(new Map(data.selected.map((w) => [w.path, w.label ?? ''])));
      })
      .catch((err) => setError(String(err)));
  }, []);

  const allPaths = [...new Set([...available, ...selected.keys()])].sort();

  const toggle = (path: string) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(path)) next.delete(path);
      else next.set(path, '');
      return next;
    });
  };

  const setLabel = (path: string, label: string) => {
    setSelected((current) => {
      const next = new Map(current);
      next.set(path, label);
      return next;
    });
  };

  const addDraft = () => {
    const trimmed = draft.trim().replace(/\/+$/, '');
    if (!trimmed) return;
    setSelected((current) => {
      if (current.has(trimmed)) return current;
      return new Map(current).set(trimmed, '');
    });
    setDraft('');
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const workspaces = [...selected].map(([path, label]) =>
        label.trim() ? { path, label: label.trim() } : { path },
      );
      await api.setWorkspaces(workspaces);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {allPaths.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay rutas detectadas. Añade una a mano más abajo.
          </p>
        ) : (
          allPaths.map((path) => {
            const isSelected = selected.has(path);
            return (
              <div key={path} className="flex items-center gap-2 text-sm">
                <Checkbox checked={isSelected} onCheckedChange={() => toggle(path)} />
                <span className="min-w-0 flex-1 truncate" title={path}>
                  {path}
                </span>
                {isSelected && (
                  <Input
                    className="h-7 w-48 shrink-0"
                    placeholder="Etiqueta (opcional)"
                    value={selected.get(path) ?? ''}
                    onChange={(event) => setLabel(path, event.target.value)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="/ruta/manual"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addDraft();
            }
          }}
        />
        <Button variant="outline" onClick={addDraft}>
          Añadir
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
        {saved && !busy && (
          <span className="text-sm text-muted-foreground">Guardado.</span>
        )}
      </div>
    </div>
  );
}
