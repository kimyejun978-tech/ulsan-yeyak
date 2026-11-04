import http from 'node:http';
import { pathToFileURL } from 'node:url';
import worker from './cloudflare-worker.js';

// Use the same routes and UI as the Worker on Node and Render.
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const response = await worker.fetch(new Request(url, { method: req.method }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'InternalServerError', message: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '0.0.0.0';
  createServer().listen(port, host, () => console.log('Ulsan reservation checker listening on port ' + port));
}

