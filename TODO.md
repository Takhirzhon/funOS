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

- [ ] **Marquee selection inside Explorer.** The desktop has it; the file list
      does not, so a range there needs Shift+click.
- [ ] **A user-settable hidden attribute.** Hiding is a rule about known system
      paths, which covers `C:\RECYCLER` and nothing else. A per-entry flag plus
      a "Show hidden files" toggle is the real version.
- [ ] **Drag a multiple selection.** Both drag systems move the one item the
      gesture started on. The clipboard understands a list now; dragging does
      not.

## Portfolio

This is somebody's portfolio as well as a desktop, and the two pull in
different directions: the desktop wants to be 2004, the portfolio wants a
recruiter on a phone to find the CV in ten seconds. The system layer
(`fs/system.ts`, `public/portfolio/`) is done and is the mechanism for all of
this; what is left is content and the places it should be reachable from.

- [ ] **A video.** The CV and the photographs are real now; `My Videos` is
      empty and Media Player has nothing to play. One clip - MP4, H.264, a
      minute or two - and the folder is a playlist again.
- [ ] **The home page follows the CV.** `apps/ie/pages.tsx` is written by
      hand from the PDF on the desktop, so the two can drift. When the CV
      changes, that file is the other place to change - or generate the
      Work page from a small JSON next to the PDF in `public/portfolio/`.

## Applications

Ordered by ratio of "makes the place feel alive" to effort.

- [ ] **Control Panel proper.** Display Properties exists and owns Themes and
      Screen Saver. It has no Desktop tab, so the wallpaper is still fixed, and
      there is no Control Panel window listing anything else.
- [ ] **Task Manager.** Ctrl+Alt+Del (and Ctrl+Shift+Esc, which the browser
      actually delivers) opens the Applications tab off `windowStore` and a
      Processes tab that lists the same things with made-up memory. End Task
      closes the window. It is the most opened window in XP after Explorer.
- [ ] **Run… Browse.** Greyed, because there is one dialog at a time and a
      file picker would replace the Run box. Either the picker returns into
      the box, or Run becomes a window. Win+R never reaches the page.
- [ ] **Search and Help and Support.** Both are Start menu items with no
      window behind them. Search can be a real search over the VFS - the
      dog is optional, the results list is not. Help can be one page.
- [ ] **Media Player: audio.** The player takes MP3 already; nothing ships
      one. `My Music` with a track in it, and the visualiser that is currently
      a gradient earns a real waveform.

## The details nobody asks for and everybody notices

Each of these is small. Together they are the difference between "a theme"
and "that is XP".

- [ ] **Rename in place.** Click a selected icon, pause, click again - or F2 -
      and the label becomes an edit box on the spot. Both the desktop and
      Explorer rename through a prompt dialog today, which is what a Mac did.
- [ ] **"Click here to begin."** The Start button's tooltip, and the hover
      highlight on the button itself. The balloon exists; the tooltip does not.
- [ ] **The tray chevron.** The arrow that hides inactive icons, and the
      "Windows can hide inactive icons" balloon the first time. The tray has
      two icons and no chevron, which is a tray from a fresh install that
      nobody has used.
- [ ] **Sounds, the rest of them.** Start-up and ding exist. Check that the
      Critical Stop plays on an error dialog and not just a ding, and that
      the shutdown sound plays over GoodbyeScreen - that one is the sound
      people remember.
- [ ] **The Windows key opens the Start menu.** It reaches the page on every
      platform where Alt+Tab does not.
- [ ] **The busy cursor.** Every app is a lazy import and the Suspense
      fallback is an empty window. That is right; the cursor should also be
      the hourglass until the chunk lands.
- [ ] **Tooltips on task buttons.** The title bar cuts a long caption with
      an ellipsis now; the task button still clips, and has no tooltip to
      show the rest.
- [ ] **A blue screen.** `crash` at the Command Prompt, or a keystroke, and
      the real one: `0x0000007B`, the memory dump counting up, any key to
      reboot into the boot screen. This is the screenshot people share.

---

## Constraints that are still binding

**Alt+Tab and Alt+F4 never reach the page on Windows.** The host window manager
claims both before the browser sees them, and `preventDefault` cannot take them
back. Both are wired up anyway — they work on some Linux desktops and in kiosk
mode, and cost nothing when they do not. The shortcut that always arrives is
`Ctrl+Alt+Left/Right`. Worth knowing before this gets filed as a bug.

**The bundle budgets are a tripwire, not a limit.** Nothing about the browser
stops this being twice the size; the numbers in `ci.yml` are chosen, and their
value is not the threshold but that crossing one has to be a decision somebody
made rather than a thing that happened. Four of them:

| | now | ceiling | what it catches |
|---|---|---|---|
| entry JS | 97KB | 120KB | a heavy library imported by the shell |
| entry CSS | 42KB | 64KB | a second UI kit next to xp.css |
| largest app chunk | 3KB | 48KB | one app pulling in something enormous |
| 3D Maze chunk | 126KB | 160KB | three.js, exempted and watched separately |
| first paint | 323KB | 400KB | the total a visitor waits for |

The entry is structural now: every app is a lazy import, so adding
applications does not grow it. Add them to `apps/registry.ts` with
`app(() => import("./Thing"), "Thing")` and they stay out by construction.

Worth knowing when one trips: **the wallpaper is 184KB, which is larger than
the entry JS and CSS together.** The code budgets guard the smaller half. If
first paint ever needs to come down, the photograph is the first place to
look, not the JavaScript.

**Small screens are two media queries, not a mode.** `(max-width: 700px)`
opens every window maximized and hides Explorer's tree; `(pointer: coarse)`
makes a single tap open, because a double tap is a zoom gesture first. Both
live in `hooks/useMediaQuery.ts` and nowhere else. Two things that bit:
`innerWidth` lies on a phone once anything is wider than the screen (the page
zooms out and reports the zoomed-out width - measure
`documentElement.clientWidth`, and the viewport meta forbids the zoom), and a
tap delivers a synthetic `mouseenter` before its `click`, so a hover-opens /
click-toggles control opens and closes in one gesture.

**The portfolio is a layer, not a seed.** `src/fs/seed.ts` runs once per
browser, so a file added there never reaches anyone who has visited before.
`public/portfolio/` is compiled into a manifest by `portfolio.plugin.ts`,
laid over the stored tree on every load by `fs/system.ts`, stripped before
every write to IndexedDB, and refused for delete, rename, move and save with
XP's "Access is denied". Put the CV in the folder, deploy, and it is on every
visitor's desktop - which is the only reason the layer exists. Do not add
portfolio content to the seed; do not make the layer writable to fix a
complaint that it is not.

**Not doing, and why.** Not twenty-eight applications - five that are
finished beat twenty that are frames. Not pdf.js - the browser renders PDFs already, and
400KB for a worse copy of that is the exact thing the chunk budget catches.

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

**The icons are the originals, and they are files.** They were SVG lookalikes
for a year, drawn to the XP grammar, and the argument was the budget: a raster
set is several hundred KB and the shell is gated at 120KB. The set is now
XP's own (`public/icons/xp/`, from softwarehistorysociety/XPIcons) and the
budget argument is answered the same way the wallpaper's was — the bytes live
outside the bundle and are fetched by `<img>` when something shows them. The
desktop costs eight small files at first paint. The licence position is the
Bliss one, stated above. Two are still drawn: the Start flag, which would be
the trademark rather than the picture, and the PDF badge, which XP never had.

---

## Ground rules

- CI gates every merge: `tsc -b`, eslint, the Vite build, the two size budgets,
  a gitleaks scan, and a real build of the production image with a smoke test.
- Merging to main deploys within ~90 seconds. There is no staging.
- Each change should leave the site in a shippable state. No branch that takes
  the desktop apart for a week.
