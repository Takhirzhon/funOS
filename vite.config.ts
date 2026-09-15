import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { portfolio } from './portfolio.plugin'

// In production nginx proxies /api/guestbook to the guestbook container
// (deploy/nginx.conf). Here the dev server and `vite preview` do the same to
// a guestbook started by hand, so the page can be tried without Docker:
//
//   GUESTBOOK_DATA=/tmp/guestbook.json PORT=8080 python3 deploy/guestbook/server.py
//
// Nothing listening means the page's "server is not answering" state, which
// is also worth seeing.
const api = { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), portfolio()],
  server: { proxy: api },
  preview: { proxy: api },
  build: {
    // Vite 8 minifies CSS with lightningcss by default, which rejects xp.css's
    // `progress:not([value]):before:not([value])` as a parse error and fails the
    // production build. esbuild accepts it.
    cssMinify: 'esbuild',
  },
})
