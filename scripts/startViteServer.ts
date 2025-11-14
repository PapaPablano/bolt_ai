import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendRoot = resolve(__dirname, '../frontend');

async function boot() {
  const server = await createServer({
    configFile: resolve(frontendRoot, 'vite.config.ts'),
    root: frontendRoot,
    server: {
      port: Number(process.env.VITE_DEV_SERVER_PORT ?? 1337),
    },
  });

  await server.listen();
  server.printUrls();
  server.bindCLIShortcuts({ print: true });
}

boot().catch((error) => {
  console.error('Failed to start Vite dev server:', error);
  process.exitCode = 1;
});
