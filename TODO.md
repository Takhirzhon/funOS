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
- [x] **A real wallpaper.** Still SVG — a photograph does not fit the budget —
      but a reconstruction with haze, layered ridges and blurred cumulus rather
      than three flat gradients.
- [ ] **Desktop icon interaction.** Drag to reposition, rubber-band selection,
      arrange-by.
- [ ] **All Programs flyout.** The button is there and disabled; the flyout is
      not built.
- [ ] **Window animations.** Minimize and restore still teleport.

## Phase 2 — the parts that make it an OS

Without these it is a themed page with four dialogs on it. With them it is a
desktop.

- [ ] **Virtual file system.** Paths, folders, files, persistence in IndexedDB.
      Everything below depends on it, which is why it is first in this phase and
      why it is worth designing rather than growing.
- [ ] **Context menus.** Right-click on the desktop, on an icon, on a taskbar
      button, on a window title bar. Nothing in funOS responds to right-click
      today, and it is the first thing anyone tries.
- [ ] **File Explorer.** Tree on the left, list on the right, address bar,
      back/forward, view modes.
- [ ] **Window manager.** Snapping, cascade/tile, Alt+Tab, Alt+F4, double-click
      to maximize (already works), keyboard focus that follows the active window.
- [ ] **Dialogs.** Properties, Open/Save, confirm, error — with the XP icons and
      the beep.
- [ ] **Drag and drop.** Files onto the desktop, between Explorer windows, onto
      app windows.

## Phase 3 — applications

Ordered by ratio of "makes the place feel alive" to effort.

- [ ] **Notepad** — exists; wire it to the VFS instead of one localStorage key.
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

## Open question: assets

Authentic fidelity wants the real Bliss photograph and the real Luna icon set,
both Microsoft copyright. daedalOS ships Windows icons regardless. The options,
in descending fidelity:

1. Ship the originals, as daedalOS does. Highest fidelity, lowest effort,
   someone else's copyright on a public site.
2. Draw high-quality SVG lookalikes. Slower, ours, and honestly achievable —
   the XP icon language is simple: soft gradients, a light source at the upper
   left, a hard outline.
3. Use an openly licensed XP-alike set and credit it.

Not decided. Phase 0's icon component should take a `name`, so the source can
change later without touching call sites.

---

## Ground rules

- CI gates every merge: `tsc -b`, eslint, the Vite build, a 120KB gzipped entry
  budget and a 64KB CSS budget. The budgets are real constraints on this list —
  a bitmap icon set blows through them, an SVG sprite does not.
- Merging to main deploys within ~90 seconds. There is no staging.
- Each phase should leave the site in a shippable state. No branch that takes
  the desktop apart for a week.
