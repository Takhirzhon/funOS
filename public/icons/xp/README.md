# Windows XP icons

Rendered from [softwarehistorysociety/XPIcons](https://github.com/softwarehistorysociety/XPIcons)
(1024px PNGs of the originals; the repository is released under the Unlicense,
the artwork is Microsoft's). Two sizes of each:

- `name.webp` — 96px, used for anything drawn at 32 or 48 CSS pixels. Sharp on
  a 2x display, which is what most of them are now.
- `name-s.webp` — 24px, for the tray, task buttons, list view and the Start
  menu's right column. A 32px icon scaled down to 16 in the browser looks
  smeared; a dedicated small render does not.

`src/icons.tsx` picks the file from the requested size; nothing else in the
project knows these paths.

To regenerate or add one: clone XPIcons, then with Pillow -

```python
im = Image.open(f"{src}/{Name}.png").convert("RGBA")
for size in (96, 24):
    t = im.copy(); t.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(t, ((size - t.width) // 2, (size - t.height) // 2), t)
    canvas.save(f"{slug}{'' if size == 96 else '-s'}.webp", "WEBP", quality=90, method=6)
```

48 icons, 96 files, ~186KB. None of it is in the entry bundle: the desktop
fetches its eight, and everything else arrives when a window shows it.
