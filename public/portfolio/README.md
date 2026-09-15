# The portfolio folder

Everything in here is served as-is by nginx and shown inside funOS as part of
the user's profile. The folder structure *is* the interface: this directory
mirrors `C:\Documents and Settings\User\`.

| here | there |
|---|---|
| `Desktop/Tokhirzhon Tashmatov - CV.pdf` | `C:\Documents and Settings\User\Desktop\...` — an icon on the desktop |
| `Desktop/anything.txt` | the same, opens in Notepad |
| `My Documents/My Pictures/*.jpg` | opens in Windows Picture Viewer, arrows walk the folder; also the `about:photos` page in Internet Explorer, where the file name is the caption |
| `My Documents/My Pictures/Portrait*.jpg` | the photograph on the `about:me` home page |
| `My Documents/My Pictures/Projects/*.jpg` | a project's screenshot on `about:projects`, "click to enlarge"; the file name is the `screenshot` field of that project in `cv.json`. Not in the photo page |
| `My Documents/My Videos/*.mp4` | opens in Windows Media Player, the folder is the playlist; the clips at the foot of `about:photos` |
| `My Documents/My Music/*.mp3` | Media Player too. The one there is generated (numpy → ffmpeg), and says so in its name; replace it with something real when there is something real with the rights to be here |
| `My Documents/My Blog/*.md` | a blog post: read in Internet Explorer at `about:blog`, listed in `rss.xml` and `sitemap.xml`, linkable as `khirokhito.tech/blog/<slug>` |
| `cv.json` | not a file in funOS: the CV as data. Work, Projects, Contact, Quick facts and What's new on the home page are drawn from it, and `portfolio.plugin.ts` writes the JSON-LD in `index.html` from it. When the PDF changes, change this |

Drop a file in, commit, merge — it is on every visitor's desktop after the
next deploy, including visitors who were here before. That is the difference
from the seed in `src/fs/seed.ts`, which only ever runs once per browser.

What the visitor can and cannot do with these: open, copy, and drag a copy
anywhere. Delete, rename, move or overwrite gets XP's "Access is denied", the
same as a system file. The originals never reach their IndexedDB.

Formats: whatever the browser plays. MP4 (H.264) and WebM for video, MP3 for
audio, JPEG/PNG/WebP for pictures, PDF for documents. `.txt` files under 64KB
are inlined into the bundle so Notepad can show them without a request; the
rest is fetched when opened. This file is ignored.

A post is Markdown with an optional front matter block (`title:`, `date:`
as YYYY-MM-DD); without one, the title is the first heading and the date the
file's modified time. The slug is the file name, lower case, punctuation to
dashes: "Hello, world.md" is `hello-world`. Headings, lists, quotes, fenced
code, bold, italic, links and images are rendered; links to `about:` pages
navigate the window, links to real sites open a real tab.

Photographs are resized to 1920px on the long side, quality 85, and saved
without EXIF - iPhone originals carry GPS coordinates, and a portfolio should
not publish where a picture was taken. `pillow` with `pillow-heif` does all
three in four lines (`ImageOps.exif_transpose`, `thumbnail`, `save` without
`exif=`); HEIC will not display in a browser and has to become JPEG.

A photograph's name is its caption, on the photo page and under the Picture
Viewer's title bar, so it should say what a caption would: "Uchitel Peak -
2, summit, 4530 m.jpg", not "IMG_4471.jpg". The photo page lists the folder
in Explorer's order, which is by name - a trip's pictures share a prefix and
a number so they stay together and in sequence.
