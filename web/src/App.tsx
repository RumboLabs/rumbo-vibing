import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, type Session } from '@/lib/api';
import { useSessions } from '@/hooks/useSessions';
import { SessionSidebar } from '@/components/SessionSidebar';
import { PaneDock } from '@/components/PaneDock';
import { SettingsPage } from '@/pages/SettingsPage';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

const STORAGE_KEY = 'cc-selected-ids';

function loadSelected(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const { sessions, connectionStatus } = useSessions();
  const [selectedIds, setSelectedIds] = useState<string[]>(loadSelected);
  const location = useLocation();
  const navigate = useNavigate();
  const isSettings = location.pathname.startsWith('/settings');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
  }, [selectedIds]);

  const handleSelect = useCallback(
    (session: Session) => {
      setSelectedIds((current) =>
        current.includes(session.id)
          ? current
          : [...current, session.id],
      );
      if (session.status === 'idle' && !session.tmuxName) {
        api.resumeSession(session.id).catch(() => {
          /* el poll reflejará si falló */
        });
      }
      // Vuelve al dashboard para ver la sesión abierta (p.ej. desde /settings).
      navigate('/');
    },
    [navigate],
  );

  const handleNewSession = useCallback(
    (id: string) => {
      setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
      // Vuelve al dashboard para ver la sesión recién creada.
      navigate('/');
    },
    [navigate],
  );

  const handleClose = useCallback((id: string) => {
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
  }, []);

  const handleKill = useCallback((id: string) => {
    api.killSession(id).catch(() => {});
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
  }, []);

  const openSessions = selectedIds
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session): session is Session => session !== undefined);

  return (
    <TooltipProvider>
      <SidebarProvider className="h-screen overflow-hidden">
        <SessionSidebar
          sessions={sessions}
          selectedIds={selectedIds}
          connectionStatus={connectionStatus}
          onSelect={handleSelect}
          onNewSession={handleNewSession}
        />
        <SidebarInset className="min-w-0">
          {/* Header persistente en ambas vistas; el texto cambia según la ruta. */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
            <SidebarTrigger />
            <span className="text-sm font-medium">
              {isSettings ? 'Configuración' : `${openSessions.length} sesión(es) abierta(s)`}
            </span>
          </header>
          {/* El dashboard se mantiene montado siempre (solo oculto en ajustes)
              para no reconectar los terminales de dockview al navegar. */}
          <div className={isSettings ? 'hidden' : 'min-h-0 flex-1'}>
            <PaneDock sessions={openSessions} onClose={handleClose} onKill={handleKill} />
          </div>
          {isSettings && (
            <div className="min-h-0 flex-1">
              <SettingsPage />
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
