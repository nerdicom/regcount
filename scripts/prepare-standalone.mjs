import { access, cp } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('.next/standalone/', root);
await access(new URL('server.js', output));
await cp(new URL('public/', root), new URL('public/', output), { recursive: true });
await cp(new URL('.next/static/', root), new URL('.next/static/', output), { recursive: true });
console.log('[regcount] Standalone server, runtime dependencies, and public assets are ready.');
