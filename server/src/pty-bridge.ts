import type { WebSocket } from 'ws';
import type { ProcessManager } from './process-manager.js';

/**
 * Conecta un WebSocket al proceso gestionado `id`: reproduce su buffer, hace
 * streaming de la salida y reenvía input/resize. No mata el proceso al cerrar el
 * WS (la sesión sigue viva en el backend).
 */
export function attachPty(ws: WebSocket, id: string, pm: ProcessManager): void {
  if (!pm.get(id)) {
    if (ws.readyState === ws.OPEN) {
      ws.send('\r\n\x1b[33m[sesión no activa: pulsa Reanudar]\x1b[0m\r\n');
    }
    ws.close();
    return;
  }

  const unsubscribe = pm.subscribe(id, (data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });

  ws.on('message', (raw) => {
    let msg: { type?: string; data?: string; cols?: number; rows?: number };
    try {
      msg = JSON.parse(raw.toString()) as typeof msg;
    } catch {
      return;
    }
    if (msg.type === 'input' && typeof msg.data === 'string') {
      pm.write(id, msg.data);
    } else if (
      msg.type === 'resize' &&
      typeof msg.cols === 'number' && msg.cols > 0 &&
      typeof msg.rows === 'number' && msg.rows > 0
    ) {
      pm.resize(id, msg.cols, msg.rows);
    }
  });

  ws.on('close', () => {
    unsubscribe();
  });
}
