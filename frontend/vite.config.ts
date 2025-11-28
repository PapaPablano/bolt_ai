import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const EDGE_BASE = env.EDGE_BASE || env.VITE_EDGE_BASE_URL || 'http://127.0.0.1:54321/functions/v1';

  return defineConfig({
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      open: true,
      proxy: {
        // Proxy all /api/* calls to Edge (stock-*, options-*, schwab-*, indicators, etc.)
        '^/api/(.*)$': {
          target: EDGE_BASE,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/?/, '/'),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            charts: ['lightweight-charts'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ['lightweight-charts'],
    },
  });
};
