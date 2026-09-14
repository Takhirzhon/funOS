# funOS — roadmap

The goal is not "a Windows XP theme". It is a desktop that someone who used XP
daily in 2004 opens and does not immediately clock as a toy. That is a different
and much higher bar, and it is mostly lost in details: the letterforms, the
two-pixel highlight along the top of the taskbar, the fact that right-click does
something.

[daedalOS](https://github.com/DustinBrett/daedalOS) is the reference for *scope*
— 28 working apps, a real file system, processes — and deliberately not for
*look*: it targets Windows 10/11 chrome. Where this list says "like daedalOS" it
means the capability, never the styling.

This file lists what is **not** done. Finished work is deleted from it rather
than ticked off — the commit log is the record of what was built and why, and a
roadmap that is nine-tenths checkboxes stops being read. What survives below the
list is the handful of decisions and constraints that are still binding.

Merging to main deploys, so nothing here counts as done until it is on
<https://khirokhito.tech>.

---

## Unfinished shell work

Small leftovers from the parts that are otherwise finished. Each one is a place
where the shape exists and the behaviour does not.

- [ ] **All Programs flyout.** The Start menu button is there and disabled.
- [ ] **Open/Save dialogs.** Notepad's Open and Save As ask for a path as text,
      which works and is not what anyone expects. They want a real file picker
      built on Explorer's list — the same component, in a dialog.
- [ ] **Properties dialog.** Every context menu has a greyed Properties row
      waiting for it.
- [ ] **Binary round-trip.** The file system can hold bytes and nothing *writes*
      them except the importer. Paint is what exercises the other direction.

## Applications

Ordered by ratio of "makes the place feel alive" to effort.

- [ ] **Command Prompt** — `dir`, `cd`, `type`, `echo`, `cls`. Reads the VFS, so
      it is mostly a parser and a scrollback.
- [ ] **Paint** — canvas, the tool palette, save to the VFS as PNG.
- [ ] **Minesweeper** — small, self-contained, and instantly recognisable.
- [ ] **Solitaire** — the card flip animation is the whole point.
- [ ] **Calculator** — Standard and Scientific.
- [ ] **Internet Explorer** — an iframe shell with the XP toolbar. Most sites
      refuse to be framed; pick ones that allow it and say so honestly rather
      than shipping a window that is blank for unexplained reasons.
- [ ] **Media Player** — audio from the VFS, with the visualiser.
- [ ] **Control Panel** — Display Properties first, so the wallpaper and the
      theme become user-changeable.

## The details nobody asks for and everybody notices

- [ ] **Boot splash and login screen.** The progress bar, then the blue user-tile
      screen.
- [ ] **Sounds.** Startup chime, ding on error, the click. Muted by default —
      autoplay policy blocks it anyway, so it needs a first-gesture unlock.
- [ ] **Themes.** Luna Blue, Olive Green, Silver. The palette is already in
      custom properties in one block of `index.css`, so this is an override
      rather than a rewrite.
- [ ] **Screensavers.** Pipes, 3D Maze, Starfield.
- [ ] **Balloon tips** from the tray.
- [ ] **Shutdown.** The dimmed overlay and the three-button dialog.

---

## Constraints that are still binding

**Alt+Tab and Alt+F4 never reach the page on Windows.** The host window manager
claims both before the browser sees them, and `preventDefault` cannot take them
back. Both are wired up anyway — they work on some Linux desktops and in kiosk
mode, and cost nothing when they do not. The shortcut that always arrives is
`Ctrl+Alt+Left/Right`. Worth knowing before this gets filed as a bug.

**The bundle budget is close.** CI fails the build over 120KB of gzipped entry
JS and 64KB of CSS; the last measurement was 100KB and 45KB. Paint, with a
canvas and a palette, is the app likely to cross it. `apps/registry.ts` is the
right place to start splitting — every app is already reached through one
lookup, so lazy-loading them is a change to that file and nothing else.

**The desktop and Explorer drag differently, on purpose.** The desktop uses
pointer events, because it is moving an icon to a *position*; Explorer uses
HTML5 drag and drop, because it is moving a file into a *folder* and has to
accept files from the host OS. They meet through a `data-drop-path` attribute
and `document.elementFromPoint`. Converting either one to the other loses
something real — check `store/dndStore.ts` before trying.

---

## Assets: decided, and worth stating plainly

**The wallpaper is the original.** `src/assets/bliss.webp` is the Bliss
photograph, fetched from the Internet Archive copy, re-encoded to WebP at
q86 — 188KB against the 369KB JPEG.

It is worth being accurate about the licence rather than repeating what the
wallpaper sites imply by hosting it: Bliss was shot by Charles O'Rear in 1996
and the rights were bought by Microsoft. It has never been released under
Creative Commons and it is not public domain. Using it here is a considered
choice on a hobby project with no commercial angle — the same one daedalOS
makes — not a licence that permits it. If this ever becomes something that
matters, `src/assets/wallpaper.svg` is still in the tree and still wired up as
the layer underneath: deleting one line in `index.css` reverts it.

**The icons stay ours.** Drawn as SVG to the XP grammar — one light source at
the upper left, a single outline, soft gradients per surface. Partly the same
licence question, mostly the budget: an authentic raster set at 16/32/48px is
several hundred KB before it draws anything. `apps/registry.ts` owns the
mapping, so swapping the source later does not touch a single call site.

---

## Ground rules

- CI gates every merge: `tsc -b`, eslint, the Vite build, the two size budgets,
  a gitleaks scan, and a real build of the production image with a smoke test.
- Merging to main deploys within ~90 seconds. There is no staging.
- Each change should leave the site in a shippable state. No branch that takes
  the desktop apart for a week.
