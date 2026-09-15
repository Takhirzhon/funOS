import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { portfolio } from './portfolio.plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), portfolio()],
  build: {
    // Vite 8 minifies CSS with lightningcss by default, which rejects xp.css's
    // `progress:not([value]):before:not([value])` as a parse error and fails the
    // production build. esbuild accepts it.
    cssMinify: 'esbuild',
  },
})
