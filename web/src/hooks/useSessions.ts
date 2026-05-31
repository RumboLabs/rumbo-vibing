import { useEffect, useState } from 'react';
import { api, type Session } from '@/lib/api';

/** Estado de la conexión en tiempo real con el backend. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseSessionsResult {
  sessions: Session[];
  connectionStatus: ConnectionStatus;
}

/** Espera antes de reintentar la conexión tras una caída. */
const RECONNECT_DELAY_MS = 3000;

export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    api
      .listSessions()
      .then((list) => {
        if (active) setSessions(list);
      })
      .catch(() => {
        /* el WebSocket entregará el estado igualmente */
      });

    const connect = () => {
      if (!active) return;
      setConnectionStatus('connecting');

      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws/events`);

      ws.onopen = () => {
        if (active) setConnectionStatus('connected');
      };
      ws.onclose = () => {
        if (!active) return;
        setConnectionStatus('disconnected');
        // Reintenta tras un margen; el indicador vuelve a "Conectando…".
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      ws.onmessage = (event) => {
        try {
          setSessions(JSON.parse(event.data as string) as Session[]);
        } catch {
          /* ignora mensajes mal formados */
        }
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return { sessions, connectionStatus };
}
