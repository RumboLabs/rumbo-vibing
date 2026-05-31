import type { ReactNode } from 'react';

interface Tip {
  title: string;
  body: ReactNode;
}

/** Atajo de teclado renderizado como tecla(s). */
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

const TIPS: { group: string; tips: Tip[] }[] = [
  {
    group: 'Terminales',
    tips: [
      {
        title: 'Copiar texto de un terminal',
        body: (
          <>
            Mantén <Kbd>Shift</Kbd> mientras arrastras para seleccionar texto y luego{' '}
            <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> para copiarlo. Sin selección, <Kbd>Ctrl</Kbd> +{' '}
            <Kbd>C</Kbd> interrumpe el comando como de costumbre.
          </>
        ),
      },
      {
        title: 'Pegar en un terminal',
        body: (
          <>
            <Kbd>Ctrl</Kbd> + <Kbd>V</Kbd> pega el contenido del portapapeles en el terminal
            activo.
          </>
        ),
      },
      {
        title: 'Hacer scroll del historial',
        body: <>Usa la rueda del ratón sobre un terminal para desplazarte por su salida.</>,
      },
      {
        title: 'Organiza los terminales como quieras',
        body: (
          <>
            Arrastra la pestaña de un terminal hacia los bordes de otro para dividir la vista
            (horizontal o vertical), reordénalos o cambia su tamaño con los separadores. El
            layout se recuerda entre recargas.
          </>
        ),
      },
      {
        title: 'Minimizar vs. cerrar',
        body: (
          <>
            El botón <Kbd>—</Kbd> de una pestaña la quita de la vista pero deja la sesión de
            Claude viva en segundo plano; el botón <Kbd>✕</Kbd> termina la sesión (pide
            confirmación). Una sesión minimizada se vuelve a abrir desde su workspace en el
            sidebar.
          </>
        ),
      },
    ],
  },
  {
    group: 'Workspaces y sesiones',
    tips: [
      {
        title: 'Solo ves lo que configuras',
        body: (
          <>
            El sidebar muestra únicamente las sesiones de los workspaces que añadas en{' '}
            <strong>Configuración → Workspaces</strong>. Cada workspace es la raíz exacta de un
            repo; puedes ponerle una etiqueta para reconocerlo de un vistazo.
          </>
        ),
      },
      {
        title: 'Crear una sesión nueva',
        body: (
          <>
            Pulsa <strong>Nueva sesión</strong> dentro de un workspace para lanzar{' '}
            <code>claude</code> en esa carpeta, igual que lo harías a mano en la terminal.
            Aparecerá en la lista en unos segundos.
          </>
        ),
      },
      {
        title: 'Plegar workspaces',
        body: (
          <>
            Haz clic en el título de un workspace para plegarlo: plegado muestra solo las
            sesiones activas; desplegado, también las recientes y el acceso a “Ver todas”.
          </>
        ),
      },
      {
        title: 'Abrir en VSCode',
        body: (
          <>
            El icono <Kbd>{'</>'}</Kbd> junto al título de un workspace abre esa carpeta en
            VSCode (requiere el comando <code>code</code> disponible en el sistema).
          </>
        ),
      },
    ],
  },
];

/** Panel de ayuda con atajos y trucos para usar Rumbo Vibing. */
export function HelpPanel() {
  return (
    <div className="flex flex-col gap-8">
      {TIPS.map(({ group, tips }) => (
        <section key={group}>
          <h3 className="mb-3 text-sm font-semibold">{group}</h3>
          <div className="flex flex-col gap-3">
            {tips.map((tip) => (
              <div
                key={tip.title}
                className="rounded-lg border border-border bg-card p-4"
              >
                <p className="text-sm font-medium">{tip.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {tip.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
