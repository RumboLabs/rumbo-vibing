import type { ComponentType, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, FolderGit2, LifeBuoy } from 'lucide-react';
import { WorkspacesPanel } from '@/components/WorkspacesPanel';
import { HelpPanel } from '@/components/HelpPanel';

interface SettingsSection {
  id: string;
  /** Grupo bajo el que se lista en el índice. */
  group: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Valor breve mostrado a la derecha de la fila (opcional). */
  meta?: string;
  element: ReactNode;
}

/** Secciones de configuración. Añade entradas aquí para nuevas opciones. */
const SECTIONS: SettingsSection[] = [
  {
    id: 'workspaces',
    group: 'General',
    label: 'Workspaces',
    description: 'Elige qué rutas se muestran en el sidebar y ponles una etiqueta.',
    icon: FolderGit2,
    element: <WorkspacesPanel />,
  },
  {
    id: 'help',
    group: 'Ayuda',
    label: 'Tips y atajos',
    description: 'Trucos para sacar partido a Rumbo Vibing.',
    icon: LifeBuoy,
    element: <HelpPanel />,
  },
];

/** Orden de aparición de los grupos en el índice. */
const GROUP_ORDER = ['General', 'Ayuda'];

function groupSections(): [string, SettingsSection[]][] {
  const byGroup = new Map<string, SettingsSection[]>();
  for (const section of SECTIONS) {
    const list = byGroup.get(section.group) ?? [];
    list.push(section);
    byGroup.set(section.group, list);
  }
  return [...byGroup.entries()].sort(
    (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const slug = location.pathname.split('/')[2] ?? '';
  const active = SECTIONS.find((s) => s.id === slug);

  // Vista de detalle de una sección.
  if (active) {
    const Icon = active.icon;
    return (
      <div className="mx-auto h-full w-full max-w-3xl overflow-auto p-6">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span>Configuración</span>
        </button>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-semibold">{active.label}</h2>
            <p className="text-sm text-muted-foreground">{active.description}</p>
          </div>
        </div>
        {active.element}
      </div>
    );
  }

  // Índice: tarjetas agrupadas (estilo Linear).
  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-auto p-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span>Vibing</span>
      </button>
      <h1 className="mb-8 font-heading text-2xl font-semibold">Configuración</h1>
      <div className="flex flex-col gap-8">
        {groupSections().map(([group, sections]) => (
          <section key={group}>
            <h2 className="mb-2 text-sm font-semibold">{group}</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => navigate(`/settings/${section.id}`)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      index > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {section.label}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {section.description}
                      </span>
                    </span>
                    {section.meta && (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {section.meta}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
