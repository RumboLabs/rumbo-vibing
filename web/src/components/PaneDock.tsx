import { useEffect, useRef, useState } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type IDockviewPanelHeaderProps,
  type DockviewApi,
} from 'dockview';
import 'dockview/dist/styles/dockview.css';
import type { Session } from '@/lib/api';
import { TerminalPane } from './TerminalPane';
import { reconcilePanels } from '@/lib/dock';
import { Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const SKIP_KILL_CONFIRM_KEY = 'cc-skip-kill-confirm';
const LAYOUT_KEY = 'cc-dock-layout';

function skipKillConfirm(): boolean {
  try {
    return localStorage.getItem(SKIP_KILL_CONFIRM_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadLayout(): unknown | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLayout(json: unknown): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(json));
  } catch {
    /* sin persistencia si localStorage falla */
  }
}

interface PaneDockProps {
  sessions: Session[];
  onClose: (id: string) => void;
  onKill: (id: string) => void;
}

/** Contenido de cada panel: el terminal de la sesión, leído de params. */
function PanelBody(props: IDockviewPanelProps<{ tmuxName: string | null }>) {
  const { tmuxName } = props.params;
  if (!tmuxName) {
    return (
      <div className="flex h-full items-center justify-center bg-black text-xs text-muted-foreground">
        Iniciando sesión…
      </div>
    );
  }
  return <TerminalPane tmuxName={tmuxName} />;
}

const components = { default: PanelBody };

/**
 * Ref a nivel de módulo para que la pestaña (registrada una vez) acceda a los
 * handlers vivos del PaneDock montado. Solo hay un PaneDock en la app.
 */
const tabHandlers: {
  current: { onClose: (id: string) => void; requestKill: (id: string) => void };
} = {
  current: { onClose: () => {}, requestKill: () => {} },
};

/** Pestaña de cada panel: título + botones de minimizar y cerrar. */
function PanelTab(props: IDockviewPanelHeaderProps) {
  const id = props.api.id;
  const title = props.api.title ?? id;
  return (
    <div className="flex items-center gap-1 px-2 text-xs">
      <span className="truncate">{title}</span>
      <button
        type="button"
        aria-label="Minimizar (deja la sesión viva en segundo plano)"
        title="Minimizar"
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          tabHandlers.current.onClose(id);
        }}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Cerrar (mata la sesión de Claude)"
        title="Cerrar sesión"
        className="rounded p-0.5 text-red-500 hover:text-red-400"
        onClick={(e) => {
          e.stopPropagation();
          tabHandlers.current.requestKill(id);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const tabComponents = { default: PanelTab };

export function PaneDock({ sessions, onClose, onKill }: PaneDockProps) {
  const apiRef = useRef<DockviewApi | null>(null);
  const [ready, setReady] = useState(false);

  // Las pestañas de dockview se registran una vez; leen los handlers actuales
  // desde este ref para no capturar versiones obsoletas.
  const handlersRef = useRef({ onClose, onKill });
  handlersRef.current.onClose = onClose;
  handlersRef.current.onKill = onKill;

  const [pendingKill, setPendingKill] = useState<{ id: string; title: string } | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Conecta el ref de módulo (usado por la pestaña) con los handlers vivos.
  tabHandlers.current.onClose = (id) => handlersRef.current.onClose(id);
  tabHandlers.current.requestKill = (id) => {
    if (skipKillConfirm()) {
      handlersRef.current.onKill(id);
      return;
    }
    const panel = apiRef.current?.getPanel(id);
    setDontAskAgain(false);
    setPendingKill({ id, title: panel?.title ?? id });
  };

  const confirmKill = () => {
    if (!pendingKill) return;
    if (dontAskAgain) {
      try {
        localStorage.setItem(SKIP_KILL_CONFIRM_KEY, 'true');
      } catch {
        /* sin persistencia si localStorage falla */
      }
    }
    handlersRef.current.onKill(pendingKill.id);
    setPendingKill(null);
  };

  const onReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    const saved = loadLayout();
    if (saved) {
      try {
        event.api.fromJSON(saved as Parameters<typeof event.api.fromJSON>[0]);
      } catch {
        /* layout corrupto: se ignora y se reconstruye desde cero */
      }
    }
    setReady(true);
  };

  // Cuando no hay sesiones, DockviewReact se desmonta (estado vacío). Al volver
  // a montar, dockview crea una API nueva; reseteamos `ready` para que onReady
  // vuelva a engancharla y los efectos (sync + persistencia) se re-suscriban.
  useEffect(() => {
    if (sessions.length === 0) {
      setReady(false);
      apiRef.current = null;
    }
  }, [sessions.length]);

  // Sincroniza los paneles con las sesiones abiertas.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !ready) return;
    const panelIds = api.panels.map((p) => p.id);
    const openIds = sessions.map((s) => s.id);
    const { toAdd, toRemove } = reconcilePanels(openIds, panelIds);

    for (const id of toRemove) {
      const panel = api.getPanel(id);
      if (panel) api.removePanel(panel);
    }
    for (const id of toAdd) {
      const session = sessions.find((s) => s.id === id);
      if (!session) continue;
      api.addPanel({
        id,
        component: 'default',
        tabComponent: 'default',
        title: session.title,
        params: { tmuxName: session.tmuxName },
      });
    }
    // Mantén título y tmuxName actualizados en paneles existentes (incluidos los
    // restaurados desde el layout guardado, que pueden traer datos obsoletos).
    for (const session of sessions) {
      const panel = api.getPanel(session.id);
      if (panel) {
        panel.api.updateParameters({ tmuxName: session.tmuxName });
        panel.api.setTitle(session.title);
      }
    }
  }, [sessions, ready]);

  // Persiste el layout (splits, orden, tamaños) con debounce.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const disposable = api.onDidLayoutChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveLayout(api.toJSON()), 300);
    });
    return () => {
      if (timer) clearTimeout(timer);
      disposable.dispose();
    };
  }, [ready]);

  const body =
    sessions.length === 0 ? (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Selecciona una sesión en la barra lateral para abrirla.
      </div>
    ) : (
      <DockviewReact
        className="dockview-theme-dark h-full w-full"
        components={components}
        tabComponents={tabComponents}
        onReady={onReady}
      />
    );

  return (
    <>
      {body}
      <Dialog open={pendingKill !== null} onOpenChange={(open) => !open && setPendingKill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar la sesión?</DialogTitle>
            <DialogDescription>
              Esto terminará la sesión de Claude
              {pendingKill ? ` «${pendingKill.title}»` : ''}. El proceso en marcha
              se detendrá. Para solo quitarla de la vista sin pararla, usa
              minimizar.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            No volver a preguntar
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingKill(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmKill}>
              Cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
