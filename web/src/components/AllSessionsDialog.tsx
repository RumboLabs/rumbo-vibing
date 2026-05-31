import { useEffect, useState } from 'react';
import type { Session, SessionStatus } from '@/lib/api';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PAGE_SIZE = 20;

const STATUS_COLOR: Record<SessionStatus, string> = {
  working: 'bg-green-500',
  waiting: 'bg-yellow-500',
  idle: 'bg-gray-400',
  dead: 'bg-red-500',
  readonly: 'bg-blue-400',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

interface AllSessionsDialogProps {
  /** Clave de filtro (deriva de la ruta), que cruza con `session.project`. */
  project: string | null;
  /** Texto a mostrar en el título; si falta, se usa `project`. */
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (session: Session) => void;
}

export function AllSessionsDialog({
  project,
  title,
  open,
  onOpenChange,
  onSelect,
}: AllSessionsDialogProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reinicia estado al abrir o cambiar de proyecto.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setDebounced('');
    setOffset(0);
  }, [open, project]);

  // Debounce de la búsqueda; al cambiar el texto vuelve a la primera página.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Carga la página actual (snapshot).
  useEffect(() => {
    if (!open || project === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listSessionsPage({ project, search: debounced, offset, limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project, debounced, offset]);

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesiones de {title || project || 'sin proyecto'}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex max-h-[70vh] min-h-72 flex-col gap-1 overflow-auto">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!error && !loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin sesiones.</p>
          )}
          {items.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => {
                onSelect(session);
                onOpenChange(false);
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLOR[session.status]}`} />
              <span className="flex-1 truncate">{session.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(session.updatedAt)}
              </span>
            </button>
          ))}
        </div>
        <DialogFooter className="items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {from}–{to} de {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Siguiente
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
