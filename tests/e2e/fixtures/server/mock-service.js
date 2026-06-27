// Mock backend service for service-web-app E2E tests (Spec 08).
//
// Usage: node mock-service.js <port>
//
// - Binds an HTTP server on <port> responding 200 (so the web app content view
//   loads successfully → did-finish-load → serviceState 'running').
// - Writes process.pid to a port-derived pid file in os.tmpdir() so the test can
//   read the pid and probe liveness after close/quit/external-kill.
//
// The pid file path is derived identically here and in the test
// (tests/e2e/serviceWebApp.spec.ts → pidFileForPort) so no path arg is needed —
// avoids MSYS/git-bash path mangling of a passed-in path argument.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = parseInt(process.argv[2], 10);
if (!port) {
  process.stderr.write('Usage: node mock-service.js <port>\n');
  process.exit(1);
}

const pidFile = path.join(os.tmpdir(), `web-nest-mock-${port}.pid`);
fs.writeFileSync(pidFile, String(process.pid));

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(
    '<!DOCTYPE html><html><head><title>Mock Service</title></head>' +
      '<body><h1>Mock Service Running</h1></body></html>',
  );
});

server.listen(port, () => {
  process.stdout.write(`mock-service listening on ${port}\n`);
});
