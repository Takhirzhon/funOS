import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Crash } from './boot/Crash.tsx'
import { reloadIfStale } from './boot/stale.ts'

/* A deploy while the tab is open leaves index.html asking for chunks that
 * are gone. Vite reports the failed import here before anything renders
 * with it; the answer is a reload, once. */
window.addEventListener('vite:preloadError', (event) => {
  if (reloadIfStale(event.payload)) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
)
