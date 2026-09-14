# funOS

[![CI](https://github.com/Takhirzhon/funOS/actions/workflows/ci.yml/badge.svg)](https://github.com/Takhirzhon/funOS/actions/workflows/ci.yml)
[![CVE Watch](https://github.com/Takhirzhon/funOS/actions/workflows/cve-watch.yml/badge.svg)](https://github.com/Takhirzhon/funOS/actions/workflows/cve-watch.yml)

A Windows XP-style desktop environment that runs in the browser. Inspired by
[daedalOS](https://github.com/DustinBrett/daedalOS), but reskinned around the
Luna theme of Windows XP.

## Stack

- React 19 + TypeScript
- Vite (dev server / bundler)
- [xp.css](https://botoxparty.github.io/XP.css/) for authentic XP window chrome
- [react-rnd](https://github.com/bokuweb/react-rnd) for draggable / resizable windows
- [zustand](https://github.com/pmndrs/zustand) for window state

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

### Why `typescript` in package.json is an alias

TypeScript 7 is the native compiler, and it dropped the JavaScript API that
every type-aware lint rule is built on. typescript-eslint refuses to load
against it outright — `require('typescript')` returning 7.x throws before ESLint
starts. So the two roles are split, which is what the 7.0 release notes call
running side by side:

```jsonc
"@typescript/native": "npm:typescript@~7.0.2",        // provides `tsc` — type checking
"typescript":         "npm:@typescript/typescript6@^6.0.2" // provides the 6.0 API — linting
```

`npx tsc` is 7.0 and is what `npm run build` type-checks with; anything that
imports `typescript` as a library gets the 6.0 API and keeps working. Both
compile the same source with the same `tsconfig`, so this is not two versions
of the language, only two consumers of one.

Drop the alias and go back to a plain `typescript` entry once typescript-eslint
ships support for 7.x ([issue #10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
`npm view typescript-eslint@latest peerDependencies` is the whole check.

## What's working today

- Desktop wallpaper (Bliss-inspired SVG)
- Desktop icons with selection + double-click to open
- Windows: drag, resize, minimize, maximize, close, focus z-ordering
- Taskbar with Start button, open-window tabs, and clock
- Two-column XP-style Start Menu
- Apps:
  - **Notepad** — textarea with File / Edit / Help menus, auto-save to localStorage, open / save-as
  - **My Computer** — placeholder drives view
  - **Recycle Bin** — empty placeholder
  - **About funOS**

## Project layout

```
src/
├── App.tsx                 # composes Desktop + Windows + Taskbar
├── icons.tsx               # inline SVG icons (My Computer, Notepad, Start logo, ...)
├── store/
│   └── windowStore.ts      # zustand store for window lifecycle
├── components/
│   ├── Desktop.tsx         # wallpaper + icon grid
│   ├── DesktopIcon.tsx
│   ├── Window.tsx          # react-rnd wrapper around xp.css window
│   ├── Taskbar.tsx
│   ├── StartButton.tsx
│   ├── StartMenu.tsx
│   └── Clock.tsx
├── apps/
│   ├── registry.ts         # appId -> { title, component, defaultSize }
│   ├── Notepad.tsx
│   ├── MyComputer.tsx
│   ├── RecycleBin.tsx
│   └── About.tsx
└── assets/
    └── wallpaper.svg
```

## CI / CD

Every push and pull request runs `.github/workflows/ci.yml`: actionlint on the
workflows, `tsc -b`, eslint, the Vite build, a gzipped bundle-size guard
(120KB entry JS / 64KB CSS), a gitleaks secret scan, and a real build of the
production image with a smoke test against the running container.
`cve-watch.yml` scans the lockfile weekly for fixable CRITICAL/HIGH advisories.

Deployment is pull-based: the server runs `deploy/auto_deploy.sh` on a ~90s
systemd timer, which watches `origin/main`, asks GitHub whether that commit's
checks passed, and only then rebuilds. **Merging to main is deploying.**

See [`deploy/README.md`](deploy/README.md) for the server setup, the Traefik
route file, and what to check when a deploy does not land.

## Roadmap

Near-term:

- Virtual file system backed by IndexedDB (BrowserFS or a thin custom layer)
- File Explorer app reading the VFS
- Right-click context menus on desktop and inside windows
- Paint clone, calculator, classic Solitaire
- Boot splash + login screen

Stretch:

- IE6-style browser shell with iframe-based browsing
- Sound effects (the XP startup chime, error ding)
- Multiple wallpapers + theme picker (Luna Blue / Olive / Silver)
- Drag-and-drop file uploads onto the desktop
