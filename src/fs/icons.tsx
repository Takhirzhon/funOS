import type { FsEntry } from "../store/fsStore";
import {
  FileIcon,
  FolderIcon,
  MusicIcon,
  NotepadIcon,
  PdfIcon,
  PictureIcon,
  VideoIcon,
} from "../icons";
import { extname } from "./path";

/* Which icon a file gets.
 *
 * One function, because the desktop, Explorer's four views and the Properties
 * dialog all have to agree - an item that is a picture in one list and a
 * generic file in another looks like two different files.
 */
export function entryIcon(entry: FsEntry, size = 32) {
  if (entry.kind === "dir") return <FolderIcon size={size} />;
  const mime = entry.mime ?? "";
  if (mime.startsWith("image/")) return <PictureIcon size={size} />;
  if (mime.startsWith("video/")) return <VideoIcon size={size} />;
  if (mime.startsWith("audio/")) return <MusicIcon size={size} />;
  if (mime === "application/pdf") return <PdfIcon size={size} />;
  return extname(entry.path) === ".txt" ? <NotepadIcon size={size} /> : <FileIcon size={size} />;
}

/** Windows shows a type for everything, and "File" for what it does not know. */
export function entryType(entry: FsEntry): string {
  if (entry.kind === "dir") return "File Folder";
  const mime = entry.mime ?? "";
  if (mime.startsWith("image/")) return `${mime.slice(6).toUpperCase()} Image`;
  /* XP's own names for these, from the days when a .avi was the whole of
   * "video on a computer". */
  if (mime.startsWith("video/")) return "Video Clip";
  if (mime.startsWith("audio/")) return "Audio File";
  if (mime === "application/pdf") return "PDF Document";
  const ext = extname(entry.path);
  if (ext === ".txt") return "Text Document";
  return ext ? `${ext.slice(1).toUpperCase()} File` : "File";
}

export const entryBytes = (entry: FsEntry): number =>
  entry.bytes ? entry.bytes.byteLength : (entry.size ?? entry.content.length);

/** "12 bytes", "3.4 KB", "1.2 MB" - the exact figure matters in Properties. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} byte${n === 1 ? "" : "s"}`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
