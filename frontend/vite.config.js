import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Built into the package root so the published server can serve it directly.
    outDir: '../ui',
    emptyOutDir: true,
  },
  server: {
    // `npm run dev` keeps hot reload while talking to a server started separately
    // with `node bin/check-dependency.js`, so the UI code stays origin-agnostic.
    proxy: { '/api': 'http://localhost:3000' },
  },
})
