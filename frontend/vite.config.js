import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The .env lives in the repository root. Only GEMINI_MODEL is exposed to
  // the bundle – the API key is entered by the user in the popup and must
  // never be built into dist/.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  envPrefix: ['VITE_', 'GEMINI_MODEL'],
  build: {
    rollupOptions: {
      input: {
        popup: `${root}index.html`,
        background: `${root}src/background.js`,
      },
      output: {
        // manifest.json expects the service worker at dist/background.js
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
