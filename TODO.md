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

- [ ] **Marquee with Ctrl.** Explorer's marquee replaces the selection, or
      starts from an empty one with Ctrl held; the desktop's replaces it
      always. XP added to the selection with Ctrl and toggled with it - the
      rectangle as a modifier, not a reset.

## Portfolio

This is somebody's portfolio as well as a desktop, and the two pull in
different directions: the desktop wants to be 2004, the portfolio wants a
recruiter on a phone to find the CV in ten seconds. The system layer
(`fs/system.ts`, `public/portfolio/`) is done and is the mechanism for all of
this; what is left is content and the places it should be reachable from.

- [ ] **Two project screenshots.** `about:projects` shows a picture for any
      project whose `screenshot` in `cv.json` names a file in
      `My Pictures\Projects`. funOS, GeoGuard (the feature-importance chart
      from its notebook) and CoVibeCode (the app) have theirs. Aegis has no
      public picture - run the GUI and take one - and Randevu has no public
      anything; both need the owner.
- [ ] **Thumbnails are made by hand.** `_thumbs/` beside each picture folder
      is what the photo page, the home page and Explorer draw; the originals
      open on click. A new photograph without one is drawn from the original
      until somebody runs the pillow step in `public/portfolio/README.md`.
      A pre-commit hook, or the plugin doing it with sharp, would make that
      automatic - sharp is a native dependency and the reason it is not.

## Applications

Ordered by ratio of "makes the place feel alive" to effort.

- [ ] **Control Panel's remaining applets.** Fourteen of the twenty-three
      still say, honestly, what they would have done. Mouse could set the
      double-click speed the desktop actually uses; Regional could pick the
      clock's 12/24-hour format; Power Options could own the screen saver's
      timer. Each is an afternoon and each is a window somebody opened.

## The details nobody asks for and everybody notices

Each of these is small. Together they are the difference between "a theme"
and "that is XP".

- [ ] **Balloon anchors.** The balloon always points at the clock. It should
      point at the icon it is about - the speaker for the mute balloon, the
      chevron for the hidden-icons one - which is a `left` computed from the
      icon's box and nothing else.
- [ ] **Solitaire's options.** Draw three, Vegas scoring, the timer, and the
      card backs to choose from. Draw one with no score is the version
      nobody actually played.

---

## Constraints that are still binding

**Alt+Tab and Alt+F4 never reach the page on Windows.** The host window manager
claims both before the browser sees them, and `preventDefault` cannot take them
back. Both are wired up anyway — they work on some Linux desktops and in kiosk
mode, and cost nothing when they do not. The shortcut that always arrives is
`Ctrl+Alt+Left/Right`. Worth knowing before this gets filed as a bug. The
same goes for Ctrl+Shift+Esc and the Win key on a Windows host - both are
wired, both work elsewhere, and the taskbar's menu, Ctrl+Esc and `taskmgr`
in Run are the paths that always arrive.

**The bundle budgets are a tripwire, not a limit.** Nothing about the browser
stops this being twice the size; the numbers in `ci.yml` are chosen, and their
value is not the threshold but that crossing one has to be a decision somebody
made rather than a thing that happened. Four of them:

| | now | ceiling | what it catches |
|---|---|---|---|
| entry JS | 97KB | 120KB | a heavy library imported by the shell |
| entry CSS | 42KB | 64KB | a second UI kit next to xp.css |
| largest app chunk | 3KB | 48KB | one app pulling in something enormous |
| WebGL savers chunk (`gl-*`) | 128KB | 160KB | three.js - 3D Maze and 3D Text behind one import, exempted and watched separately |
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

**The link preview is a screenshot, taken by hand.** `public/og.jpg` is
the desktop at 1200x630 with Internet Explorer on the home page, and it is
what Telegram, LinkedIn and Instagram show under a link to the site. It is
not regenerated by the build; when the desktop changes enough to matter,
retake it (headless Chromium at 1200x630, log in, open IE, screenshot) and
commit it next to `robots.txt` and `sitemap.xml`.

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

**A `<button>` does not drag in Chromium unless told to.** A draggable button
starts no native drag with a real mouse - only with synthetic events, which is
why the headless tests passed for weeks while Explorer-to-desktop did nothing
for anyone with a hand. `-webkit-user-drag: element` on `.item` is the fix;
keep it when the item's styles are next rewritten.

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
Bliss one, stated above. The flag is the 2002 logo's own paths (Wikimedia
Commons, "Windows logo - 2002–2012 (Multicolored).svg") with the Start
button's gradients put back; the PDF badge is still drawn, since XP never
had one.

---

## Ground rules

- CI gates every merge: `tsc -b`, eslint, the Vite build, the two size budgets,
  a gitleaks scan, and a real build of the production image with a smoke test.
- Merging to main deploys within ~90 seconds. There is no staging.
- Each change should leave the site in a shippable state. No branch that takes
  the desktop apart for a week.
