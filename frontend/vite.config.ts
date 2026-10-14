import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Prefer 5173, but choose the next free port when another dev server is running.
      strictPort: false,
      // Required when sharing the development UI through a temporary ngrok hostname.
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },
  };
});
