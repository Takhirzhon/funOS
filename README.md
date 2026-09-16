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

## It is also a portfolio

`public/portfolio/` mirrors `C:\Documents and Settings\User\`, and whatever is
in it appears inside funOS on every visit - the CV on the desktop, the
photographs in My Pictures, the clips in My Videos. Drop a file in, merge, and
it is there for everyone, including people who were here before (the seed file
system runs only once per browser; this layer runs every time). Visitors can
open and copy these files and get XP's "Access is denied" if they try to
delete one. [`public/portfolio/README.md`](public/portfolio/README.md) has the
mapping and the formats.

## What's working today

- Desktop wallpaper (Bliss-inspired SVG)
- Desktop icons with selection + double-click to open
- Windows: drag, resize, minimize, maximize, close, focus z-ordering
- Taskbar with Start button, open-window tabs with tooltips, the tray chevron that hides inactive icons, and clock; balloons point at the icon they are about
- Rename in place: F2, click-pause-click, or the menu, on the desktop and in Explorer
- Drag and drop everywhere: desktop to Explorer, Explorer to desktop (the file lands where it was let go), between Explorer windows and the tree, onto the Recycle Bin
- Sounds, synthesized and on by default (the tray speaker mutes): start-up, log off, exit, Critical Stop, Exclamation, the balloon, Start Navigation on every folder, page and window, a click for every menu, cards in Solitaire, the mine and the win in Minesweeper, minimize and restore, the Recycle Bin - and "Windows is shutting down..." before the black screen
- Two-column XP-style Start Menu
- Apps:
  - **Notepad** — File / Edit / Help menus, open / save-as against the virtual file system
  - **Explorer** and **My Computer** — a real file system in IndexedDB, four views, drag and drop, Recycle Bin
  - **Windows Picture Viewer** — with Previous / Next through the folder
  - **Windows Media Player** — video and audio, the folder is the playlist, Bars for anything without a picture; My Music has Beethoven's Eroica Scherzo by the Czech National Symphony Orchestra (Musopen Symphony, public domain)
  - **PDF Reader** — the browser's renderer in an XP frame, with Save a Copy
  - **Internet Explorer** — the front door: a hand-written `about:me` home page with Work, Projects, Photos, Guestbook and Contact, drawn from `public/portfolio/cv.json` and the files in My Pictures; real sites open in a real tab, and anything else gets "The page cannot be displayed"
  - A guestbook — `deploy/guestbook/` is a second container (one Python file, a JSON file on a volume) that nginx proxies at `/api/guestbook`; `vite dev` and `vite preview` proxy the same path to a copy started by hand (see `vite.config.ts`)
  - A blog — Markdown files in `My Documents\My Blog`, read at `about:blog`, with `rss.xml` and `sitemap.xml` generated from the folder at build time
  - Deep links — `/work`, `/projects`, `/photos`, `/contact`, `/blog`, `/blog/<slug>` open Internet Explorer on that page once the desktop is up, and `/cv` opens the PDF; the address bar follows Internet Explorer while it is open. The mapping is `ROUTES` in `src/apps/ie/site.ts`; a crawler gets the JSON-LD that `portfolio.plugin.ts` writes into `index.html` from `cv.json`, since the pages are drawn inside a window it never opens
  - **Paint**, **Command Prompt**, **Calculator**, **Minesweeper** (the window is the size of the board), **Solitaire** (the cards.dll bitmaps, all twelve backs under Game > Deck; Draw one/three, Standard and Vegas scoring, the timer; drag the cards, or click; double-click sends one home)
  - **DOOM** — on the desktop; the 1995 shareware episode in DOSBox compiled to WebAssembly (js-dos 7), four megabytes under `/doom/` fetched on first open; keys go to the game only while its window has focus
  - **Display Properties** — Luna Blue / Olive / Silver, screensavers including 3D Maze and 3D Text (the owner's name, on three.js, one lazy chunk for both)
  - **System Properties** — right-click My Computer, or Pause: registered to, build from `/health`, what the browser knows about the machine
  - **Run…** — `notepad`, `calc`, `mspaint`, `sol`, `winmine`, `doom`, `sysdm.cpl`, `taskmgr`, a path, or an address
  - **Control Panel** — classic view, twenty-three applets; Display (themes, desktop background from any picture, screen savers), System, Folder Options, Add or Remove Programs, Date and Time (the clock's zone), Sounds (scheme, volume, the events list), Taskbar and Start Menu (lock, auto-hide, Quick Launch, the clock) open; the rest say what they would have done
  - **Search** and **Help and Support** — the Search Companion over the file system, with a dog, and one help page with the shortcuts
  - **Task Manager** — Applications (real), Processes (the windows as their .exe names, plus every XP machine's svchost.exe), Performance with a measured CPU graph. Ending csrss.exe does what it did.
  - A blue screen — `crash` at the Command Prompt or in Run, the memory dump, any key to reboot
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

What is not done yet, and the decisions that are still binding, live in
[`TODO.md`](TODO.md). Finished work is deleted from it rather than ticked off.
