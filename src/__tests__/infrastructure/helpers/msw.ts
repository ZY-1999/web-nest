import type { SetupServer } from 'msw/node';

let server: SetupServer | null = null;

export async function startMsw(): Promise<void> {
  if (server) {
    return;
  }
  const { setupServer } = await import('msw/node');
  server = setupServer();
  server.listen();
}

export async function stopMsw(): Promise<void> {
  if (!server) {
    return;
  }
  server.close();
  server = null;
}

export function getServer(): SetupServer {
  if (!server) {
    throw new Error('MSW server not started. Call startMsw() first.');
  }
  return server;
}
