# The portfolio folder

Everything in here is served as-is by nginx and shown inside funOS as part of
the user's profile. The folder structure *is* the interface: this directory
mirrors `C:\Documents and Settings\User\`.

| here | there |
|---|---|
| `Desktop/CV.pdf` | `C:\Documents and Settings\User\Desktop\CV.pdf` — an icon on the desktop |
| `Desktop/About Me.txt` | the same, opens in Notepad |
| `My Documents/My Pictures/*.jpg` | opens in Windows Picture Viewer, arrows walk the folder |
| `My Documents/My Videos/*.mp4` | opens in Windows Media Player, the folder is the playlist |
| `My Documents/My Music/*.mp3` | Media Player too |

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

The files that are here now are placeholders so the desktop has something on
it. Replace them.
