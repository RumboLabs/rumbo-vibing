import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

/**
 * Tema del "chrome" del terminal acorde a la marca Rumbo (fondo negro de marca,
 * cursor y selección en terracota). NO se redefinen los 16 colores ANSI para no
 * alterar la TUI de Claude Code.
 */
const RUMBO_TERMINAL_THEME = {
  background: '#121212', // hsl(0 0% 7%) aprox: fondo negro de marca
  foreground: '#f2ead9', // crema (hsl 44 35% 94%)
  cursor: '#c9783d', // terracota (primary, hsl 25 55% 52%)
  cursorAccent: '#121212',
  selectionBackground: 'rgba(201, 120, 61, 0.35)', // terracota translúcido
};

/**
 * Terminales montados, con su contenedor DOM. Permite que solo uno tenga
 * selección a la vez: al hacer clic en cualquier sitio se limpia la selección de
 * los terminales cuyo contenedor no contiene el punto del clic (cada xterm es
 * independiente y no se entera del resto).
 */
const liveTerminals = new Map<Terminal, HTMLElement>();

let globalMouseDownBound = false;

function bindGlobalMouseDown(): void {
  if (globalMouseDownBound) return;
  globalMouseDownBound = true;
  document.addEventListener(
    'mousedown',
    (event) => {
      const target = event.target as Node | null;
      for (const [term, container] of liveTerminals) {
        if (term.hasSelection() && (!target || !container.contains(target))) {
          term.clearSelection();
        }
      }
    },
    true, // capture: corre antes de que xterm inicie su propia selección
  );
}

interface TerminalPaneProps {
  tmuxName: string;
}

export function TerminalPane({ tmuxName }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
      theme: RUMBO_TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Solo ajusta si el contenedor es visible y tiene tamaño real. Evita que un
    // ResizeObserver disparado con el pane oculto (display:none al ir a
    // /settings) o de tamaño 0 mande un resize minúsculo a tmux, que reflotaría
    // su buffer a columnas estrechas y destrozaría el scrollback.
    const fitIfVisible = (): boolean => {
      if (container.offsetParent === null) return false;
      if (container.clientWidth === 0 || container.clientHeight === 0) return false;
      fitAddon.fit();
      return true;
    };

    fitIfVisible();
    liveTerminals.set(term, container);
    bindGlobalMouseDown();

    // Ctrl+C copia si hay selección; si no, deja pasar el SIGINT al terminal.
    // Ctrl+V pega desde el portapapeles.
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown' || !event.ctrlKey || event.shiftKey || event.altKey) {
        return true;
      }
      if (event.key === 'c' && term.hasSelection()) {
        navigator.clipboard?.writeText(term.getSelection()).catch(() => {});
        return false; // no enviar Ctrl+C al pty
      }
      if (event.key === 'v') {
        navigator.clipboard
          ?.readText()
          .then((text) => {
            if (text && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'input', data: text }));
            }
          })
          .catch(() => {});
        return false; // gestionamos el pegado nosotros
      }
      return true;
    });

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/pty/${encodeURIComponent(tmuxName)}`,
    );

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN && term.cols > 0 && term.rows > 0) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.onopen = () => sendResize();
    ws.onmessage = (event) => term.write(event.data as string);
    ws.onclose = () => term.write('\r\n\x1b[33m[sesión desconectada]\x1b[0m\r\n');

    const dataSub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const observer = new ResizeObserver(() => {
      if (fitIfVisible()) sendResize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      dataSub.dispose();
      liveTerminals.delete(term);
      ws.close();
      term.dispose();
    };
  }, [tmuxName]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden p-1.5"
      style={{ backgroundColor: RUMBO_TERMINAL_THEME.background }}
      // Evita el menú contextual del navegador al hacer clic derecho en el terminal.
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
