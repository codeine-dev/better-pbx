import { execSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const gitSha = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.PBX_VERSION ?? '0.1.0'),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
  server: {
    port: 5173,
  },
});
