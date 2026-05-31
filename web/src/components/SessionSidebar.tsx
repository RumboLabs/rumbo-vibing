import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Session, SessionStatus, Workspace } from '@/lib/api';
import { api } from '@/lib/api';
import type { ConnectionStatus } from '@/hooks/useSessions';
import {
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Code, Plus, Settings } from 'lucide-react';
import { AllSessionsDialog } from './AllSessionsDialog';

const STATUS_META: Record<SessionStatus, { color: string; label: string }> = {
  working: { color: 'bg-green-500', label: 'Trabajando' },
  waiting: { color: 'bg-yellow-500', label: 'Esperando input' },
  idle: { color: 'bg-gray-400', label: 'Idle' },
  dead: { color: 'bg-red-500', label: 'Caída' },
  readonly: { color: 'bg-blue-400', label: 'Solo lectura' },
};

/** Texto y aspecto del indicador de conexión en tiempo real. */
const CONNECTION_META: Record<
  ConnectionStatus,
  { color: string; label: string; pulse: boolean }
> = {
  connecting: { color: 'bg-yellow-500', label: 'Conectando…', pulse: true },
  connected: { color: 'bg-green-500', label: 'Conectado', pulse: false },
  disconnected: { color: 'bg-red-500', label: 'Sin conexión', pulse: false },
};

const COLLAPSE_KEY = 'cc-collapsed-workspaces';
const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Una sesión está activa si Claude trabaja o espera input. */
function isActive(s: Session): boolean {
  return s.status === 'working' || s.status === 'waiting';
}

/** Etiqueta de un workspace: los dos últimos segmentos de la ruta. */
function workspaceLabel(path: string): string {
  if (typeof path !== 'string') return String(path ?? '');
  return path.split('/').filter(Boolean).slice(-2).join('/') || path;
}

/**
 * Normaliza la respuesta de workspaces a `{ path, label? }`, tolerando el
 * formato antiguo (array de strings) por si el backend aún no se ha recargado.
 */
function normalizeWorkspaces(selected: unknown): Workspace[] {
  if (!Array.isArray(selected)) return [];
  return selected
    .map((w): Workspace | null => {
      if (typeof w === 'string') return { path: w };
      if (w && typeof w === 'object' && typeof (w as Workspace).path === 'string') {
        return w as Workspace;
      }
      return null;
    })
    .filter((w): w is Workspace => w !== null);
}

/** Workspaces plegados (por defecto desplegados: solo guardamos los plegados). */
function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

interface SessionSidebarProps {
  sessions: Session[];
  selectedIds: string[];
  connectionStatus: ConnectionStatus;
  onSelect: (session: Session) => void;
  onNewSession: (id: string) => void;
}

export function SessionSidebar({
  sessions,
  selectedIds,
  connectionStatus,
  onSelect,
  onNewSession,
}: SessionSidebarProps) {
  const [query, setQuery] = useState('');
  const [openSection, setOpenSection] = useState<{ project: string; title: string } | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const navigate = useNavigate();
  const location = useLocation();

  // Carga la lista al montar y en cada navegación, para que la sidebar esté
  // poblada en cualquier ruta (no solo en el dashboard) y refleje los cambios
  // al volver de /settings tras editar workspaces.
  useEffect(() => {
    let active = true;
    api
      .getWorkspaces()
      .then((data) => {
        if (active) setWorkspaces(normalizeWorkspaces(data.selected));
      })
      .catch(() => {
        // En error dejamos la lista sin cambiar: no enmascaramos un fallo de
        // red como "sin workspaces configurados". El próximo ciclo reintentará.
      });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const toggleCollapsed = (ws: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(ws)) next.delete(ws);
      else next.add(ws);
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
      } catch {
        /* sin persistencia si localStorage falla */
      }
      return next;
    });
  };

  const sections = useMemo(() => {
    const now = Date.now();
    const q = query.toLowerCase();
    const byRecent = (a: Session, b: Session) =>
      a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0;
    const isRecent = (s: Session) =>
      isActive(s) || now - new Date(s.updatedAt).getTime() < RECENT_WINDOW_MS;
    return (workspaces ?? []).map((w) => {
      const ws = w.path;
      const all = sessions.filter(
        (s) => s.cwd === ws && `${s.title} ${s.project}`.toLowerCase().includes(q),
      );
      // Colapsado: solo activas. Desplegado: activas + recientes (<3 días).
      const active = all.filter(isActive).sort(byRecent);
      const recent = all.filter(isRecent).sort(byRecent);
      return {
        ws,
        // Etiqueta mostrada: la del usuario o, si no, derivada de la ruta.
        label: w.label || workspaceLabel(ws),
        // Clave de filtro del dialog (cruza con session.project).
        projectKey: workspaceLabel(ws),
        active,
        recent,
        hiddenCount: all.length - recent.length,
        total: all.length,
      };
    });
  }, [sessions, query, workspaces]);

  const openInVscode = (ws: string) => {
    api.openInVscode(ws).catch(() => {
      /* abrir en VSCode falló (code no disponible); no bloquea la UI */
    });
  };

  const createSession = (ws: string) => {
    api
      .createSession({ cwd: ws })
      .then((created) => onNewSession(created.id))
      .catch(() => {
        /* el poll reflejará si falló */
      });
  };

  return (
    <Sidebar>
      <SidebarHeader className="gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Ir al inicio"
          className="-mx-2 -mt-2 block cursor-pointer"
        >
          <img
            src="/logos/rumbo-vibing-sin-fondo-claro.webp"
            alt="Rumbo Vibing"
            className="block w-full dark:hidden"
          />
          <img
            src="/logos/rumbo-vibing-sin-fondo-oscuro.webp"
            alt="Rumbo Vibing"
            className="hidden w-full dark:block"
          />
        </button>
        <div className="px-1">
          <span className="text-sm font-semibold">Sesiones de Claude</span>
        </div>
        <Input
          placeholder="Buscar…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </SidebarHeader>
      <SidebarContent>
        {workspaces === null ? null : workspaces.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No hay workspaces configurados.
            </p>
            <Button size="sm" onClick={() => navigate('/settings')}>
              + Workspace
            </Button>
          </div>
        ) : (
          sections.map(({ ws, label, projectKey, active, recent, hiddenCount, total }) => {
            const isCollapsed = collapsed.has(ws);
            const list = isCollapsed ? active : recent;
            return (
              <SidebarGroup key={ws}>
                <SidebarGroupLabel className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(ws)}
                    aria-expanded={!isCollapsed}
                    className="flex min-w-0 flex-1 items-center gap-1"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openInVscode(ws)}
                    aria-label="Abrir en VSCode"
                    title="Abrir en VSCode"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Code className="h-4 w-4" />
                  </button>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="text-muted-foreground"
                        onClick={() => createSession(ws)}
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className="truncate">Nueva sesión</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {list.map((session) => {
                      const meta = STATUS_META[session.status];
                      return (
                        <SidebarMenuItem key={session.id}>
                          <SidebarMenuButton
                            isActive={selectedIds.includes(session.id)}
                            tooltip={meta.label}
                            onClick={() => onSelect(session)}
                          >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.color}`} />
                            <span className="truncate">{session.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                    {!isCollapsed && hiddenCount > 0 && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="text-muted-foreground"
                          onClick={() => setOpenSection({ project: projectKey, title: label })}
                        >
                          <span className="truncate">Ver todas ({total})</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>
      <SidebarFooter>
        <div
          className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {CONNECTION_META[connectionStatus].pulse && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${CONNECTION_META[connectionStatus].color}`}
              />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${CONNECTION_META[connectionStatus].color}`}
            />
          </span>
          <span className="truncate">{CONNECTION_META[connectionStatus].label}</span>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => navigate('/settings')}
        >
          <Settings />
          <span>Configuración</span>
        </Button>
      </SidebarFooter>
      <AllSessionsDialog
        project={openSection?.project ?? null}
        title={openSection?.title}
        open={openSection !== null}
        onOpenChange={(open) => {
          if (!open) setOpenSection(null);
        }}
        onSelect={onSelect}
      />
    </Sidebar>
  );
}
