import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { createApiRouter } from './api.js';
import { SessionRegistry } from './sessions.js';
import { attachPty } from './pty-bridge.js';
import { ProcessManager } from './process-manager.js';

const PORT = 4317;

async function main(): Promise<void> {
  const processManager = new ProcessManager();
  const registry = new SessionRegistry(processManager);
  await registry.start();

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(registry, processManager));

  // Sirve el frontend compilado si existe (modo producción: pnpm --filter web build).
  const webDist = join(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  const server = createServer(app);
  const eventsWss = new WebSocketServer({ noServer: true });
  const ptyWss = new WebSocketServer({ noServer: true });

  eventsWss.on('connection', (ws) => {
    const unsubscribe = registry.subscribe((sessions) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(sessions));
    });
    ws.on('close', unsubscribe);
  });

  // Orígenes permitidos para las conexiones WebSocket. Defiende contra
  // Cross-Site WebSocket Hijacking: una web maliciosa abierta en el navegador
  // no puede conectar al backend local porque su Origin no está en la lista.
  const allowedOrigins = new Set([
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
    // Vite dev server (frontend en desarrollo).
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);

  server.on('upgrade', (req, socket, head) => {
    // Rechaza upgrades cuyo Origin no esté permitido (o falte).
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const url = new URL(req.url ?? '', 'http://localhost');

    if (url.pathname === '/ws/events') {
      eventsWss.handleUpgrade(req, socket, head, (ws) => {
        eventsWss.emit('connection', ws, req);
      });
      return;
    }

    const ptyMatch = url.pathname.match(/^\/ws\/pty\/(.+)$/);
    if (ptyMatch) {
      const id = decodeURIComponent(ptyMatch[1]);
      if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
        socket.destroy();
        return;
      }
      ptyWss.handleUpgrade(req, socket, head, (ws) => {
        attachPty(ws, id, processManager);
      });
      return;
    }

    socket.destroy();
  });

  server.on('error', (err) => {
    console.error('Error del servidor:', err);
    process.exit(1);
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Claude Sessions backend en http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fallo al arrancar el servidor:', err);
  process.exit(1);
});
