import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { buildPage } from './build.mjs';

let page = await buildPage();
let pending;
watch('src', { recursive: true }, () => {
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try { page = await buildPage(); } catch (error) { console.error(error); }
  }, 120);
});
const port = Number(process.env.PORT || 4173);
createServer((request, response) => {
  if (request.url === '/' || request.url === '/index.html' || request.url?.startsWith('/?')) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(page);
  } else { response.writeHead(404); response.end('Nu e nimic aici.'); }
}).listen(port, '0.0.0.0', () => console.log(`Păcănele: http://localhost:${port}`));
