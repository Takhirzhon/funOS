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

Checked items are done and live on <https://khirokhito.tech>. Merging to main
deploys, so nothing here is "done" until it is on that URL.

---

## Phase 0 — the foundation everything else inherits

Doing this first because every item in later phases is cheaper afterwards and
more expensive if skipped. Right now each component carries its own inline
`style={{...}}` object, so there is no such thing as "the taskbar colour" — there
are four spellings of it in three files.

- [x] **Fix the font.** The single most visible defect, and worse than it
      looked: `xp.css` sets `body{font-family:Arial}` — which beats `:root` — and
      points every *control* (`button`, `input`, `select`, `.status-bar-field`,
      `ul.tree-view`) at **"Pixelated MS Sans Serif"**, the Windows *95/98*
      bitmap face. So the shell was Arial and the widgets were 1998. XP is
      Tahoma 8pt (11px) throughout. Tahoma is not redistributable, so it is a
      stack — local Tahoma, then Verdana, then DejaVu Sans — rather than a
      ~100KB webfont against a 120KB budget. Captions stay Trebuchet MS, which
      xp.css gets right except that it declares no fallback at all, so a machine
      without Trebuchet was rendering every title bar in the default serif.
- [x] **Move styling out of JSX.** Shell components now have `*.module.css` and
      the Luna palette lives in custom properties in `index.css`. Phase 4's
      theme switcher is now an override of that one block. The four *apps* still
      style inline; they get done as each is rewritten against the VFS.
- [x] **Luna scrollbars.** `xp.css` ships Windows *98* scrollbars — grey, square,
      with a dithered trough. Replaced with Luna's blue gradient thumb, plus
      `scrollbar-color` so Firefox at least gets the palette.
- [x] **One source of truth per app.** `apps/registry.ts` now owns the icon and
      the short label, so the desktop, the task button and the Start menu cannot
      disagree about what an app is called or looks like. The icon set is inline
      SVG on purpose: an authentic raster set at 16/32/48px is several hundred
      KB before it draws anything, and the entry budget is 120KB.

## Phase 1 — Luna chrome

The "cheap copy" complaint is almost entirely this phase.

- [x] **Taskbar.** Eleven-stop gradient, the 1px top highlight, grips between
      sections, task buttons that show the app's icon and are genuinely sunken
      when active.
- [x] **Start button.** Was a `clipPath: polygon()` trapezoid — the wrong shape,
      and clip-path was cutting off the gloss and the shadow with it. Now a
      rounded cap flush with the left screen edge, over the right green, with a
      pressed state.
- [x] **System tray.** Recessed band in its own blue with the bevel on its left
      edge, three notification icons, and the clock inside it rather than
      painting a second gradient that left a seam.
- [x] **Quick Launch.** Show Desktop works; the IE button is disabled until
      there is a browser to launch.
- [x] **Window chrome — inactive state.** xp.css has no concept of an unfocused
      window, which is why the old code reached for `saturate(0.4)` over the
      active gradient and bleached the caption and the close button along with
      it. Now a real Luna inactive caption, plus a drop shadow that says which
      window is on top — on the react-rnd wrapper, because xp.css builds the
      entire blue frame out of stacked `inset` shadows and an outer shadow on
      the same element deletes it.
- [x] **Start menu.** Header with the user tile, gold hairlines, two columns,
      the places list, the footer with Log Off / Turn Off Computer. Entries with
      nothing behind them render disabled rather than being omitted — the shape
      of the menu is half of what makes it recognisable, and a greyed row is an
      honest "not built yet".
- [x] **Desktop icon look.** Drop shadow, double text shadow so labels survive a
      light wallpaper, and selection that follows the icon's silhouette instead
      of boxing it. Selection state lifted out of the icons: it was `useState`
      per icon cleared on blur, so two icons could both look selected.
- [x] **A real wallpaper.** The actual Bliss photograph, 1920x1080 WebP at 188KB,
      with the SVG reconstruction still layered underneath it — so the desktop
      is never a white rectangle while 188KB downloads, and never one at all on
      a browser without WebP. See *Assets* below for the licence, which is not
      what the wallpaper sites imply.
- [x] **Desktop icon interaction.** Drag to reposition with snap-to-lattice,
      marquee selection, and positions that survive a reload. The field stopped
      being a CSS grid to get there — icons carry their own coordinates now, and
      the lattice is applied on drop.
- [x] **Window animations.** Minimize and restore no longer teleport. The
      window stays mounted and swaps between two animation classes, which is
      also what makes minimize preserve the app's state instead of throwing it
      away — the old code unmounted on the frame the flag flipped.
- [x] **Arrange icons by name / auto-arrange.** In the desktop context menu.
- [ ] **All Programs flyout.** The button is there and disabled; the flyout is
      not built.

## Phase 2 — the parts that make it an OS

Without these it is a themed page with four dialogs on it. With them it is a
desktop.

- [x] **Virtual file system.** `src/fs/` and `store/fsStore.ts`. Paths are
      canonical with forward slashes internally and backslashes only where a
      person sees them. Entries are a **flat map keyed by path**, not a tree:
      rename, move and recursive delete are the operations a tree of objects
      gets wrong, and against a flat map they are all key rewrites. Persisted to
      IndexedDB as one blob, debounced, degrading to "no persistence" rather
      than refusing to boot. Hydration replaces the seed wholesale — merging
      would resurrect every seeded file the moment someone deleted one.
- [x] **Context menus.** Desktop, icon, taskbar button and title bar, with
      submenus, viewport flipping and Escape. One menu globally rather than one
      per component: two open at once is a bug you only see in a screenshot, and
      every local copy has to re-solve dismissal and edge flipping. Rows with
      nothing behind them yet are disabled rather than omitted — Cut, Copy,
      Rename, Properties — for the same reason the Start menu keeps its greyed
      rows. Arrange Icons By works.
- [x] **File Explorer.** Folder tree, item list, address bar you can type a path
      into, Back/Forward/Up, New Folder, New Text Document, Rename, Delete, and
      a status bar. History is a stack and a cursor, so navigating from the
      middle truncates what was ahead of it. Double-clicking a file opens it in
      Notepad.
- [ ] **Explorer view modes.** Only the icon view exists; Details, List and
      Thumbnails do not.
- [ ] **Window manager.** Snapping, cascade/tile, Alt+Tab, Alt+F4, double-click
      to maximize (already works), keyboard focus that follows the active window.
- [x] **Dialogs — prompt, confirm, error.** Real windows in the desktop rather
      than `prompt()`/`confirm()`/`alert()`, which cannot be styled, drop out of
      the top of the viewport, and block the main thread so every animation
      stops while they are up. Resolved through a promise, so calling code still
      reads `if (await confirmDialog(...))`.
- [ ] **Dialogs — Open/Save and Properties.** Notepad's Open and Save As ask for
      a path as text. They want a real file picker built on Explorer's list.
- [ ] **Drag and drop.** Files onto the desktop, between Explorer windows, onto
      app windows.

## Phase 3 — applications

Ordered by ratio of "makes the place feel alive" to effort.

- [x] **Notepad** — reads and writes the VFS. New, Open, Save, Save As, a dirty
      marker in the caption, and a prompt before discarding unsaved changes.
      The window caption is set through the store, so the title bar and the task
      button cannot disagree about which file is open.
- [ ] **File Explorer** — see Phase 2.
- [ ] **Command Prompt** — `dir`, `cd`, `type`, `echo`, `cls`. Reads the VFS.
- [ ] **Paint** — canvas, the tool palette, save to the VFS as PNG.
- [ ] **Minesweeper** — small, self-contained, and instantly recognisable.
- [ ] **Solitaire** — the card flip animation is the whole point.
- [ ] **Calculator** — Standard and Scientific.
- [ ] **Internet Explorer** — an iframe shell with the XP toolbar. Most sites
      refuse to be framed; pick ones that allow it and say so honestly.
- [ ] **Media Player** — audio from the VFS, with the visualiser.
- [ ] **Control Panel** — Display Properties first, so the wallpaper and the
      theme become user-changeable.

## Phase 4 — the details nobody asks for and everybody notices

- [ ] **Boot splash and login screen.** The progress bar, then the blue user-tile
      screen.
- [ ] **Sounds.** Startup chime, ding on error, the click. Muted by default —
      autoplay policy blocks it anyway, so it needs a first-gesture unlock.
- [ ] **Themes.** Luna Blue, Olive Green, Silver. Cheap once Phase 0 puts the
      palette in custom properties, absurd before that.
- [ ] **Screensavers.** Pipes, 3D Maze, Starfield.
- [ ] **Balloon tips** from the tray.
- [ ] **Shutdown.** The dimmed overlay and the three-button dialog.

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
several hundred KB before it draws anything, and the entry bundle is capped at
120KB. `apps/registry.ts` owns the mapping, so swapping the source later does
not touch a single call site.

---

## Ground rules

- CI gates every merge: `tsc -b`, eslint, the Vite build, a 120KB gzipped entry
  budget and a 64KB CSS budget. The budgets are real constraints on this list —
  a bitmap icon set blows through them, an SVG sprite does not.
- Merging to main deploys within ~90 seconds. There is no staging.
- Each phase should leave the site in a shippable state. No branch that takes
  the desktop apart for a week.
