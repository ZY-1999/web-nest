import type { SetupServer } from 'msw/node';

let server: SetupServer | null = null;

export function setServer(s: SetupServer) {
  server = s;
}

export function cleanup() {
  if (server) {
    server.resetHandlers();
  }
}

export const data = {
  seed<T extends Record<string, unknown>>(_fixtures: T) {
    if (!server) {
      throw new Error('MSW server not started. Call startMsw() first.');
    }
  },
};
