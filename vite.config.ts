import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    server: {
      port: 3000,
      host: '0.0.0.0', // Critical for Docker/Coolify networking
       allowedHosts: true,
    },
    preview: {
      port: 3000,
      host: '0.0.0.0', // Critical for Production Preview
       allowedHosts: true,
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});