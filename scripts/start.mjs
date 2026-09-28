import { access } from 'node:fs/promises';

const server = new URL('../.next/standalone/server.js', import.meta.url);
try {
  await access(server);
} catch {
  console.error('[regcount] Production server is missing. Run npm run build before npm start.');
  process.exit(1);
}

// Match the previous next start binding; retain the hosting platform's PORT.
process.env.HOSTNAME = '0.0.0.0';
console.log('[regcount] Starting the standalone production server.');
await import(server.href);
