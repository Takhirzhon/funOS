import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blobUrlFor, listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { errorDialog, fileDialog } from "../store/dialogStore";
import { basename, dirname, display, normalize } from "../fs/path";
import { MY_DOCUMENTS } from "../fs/seed";
import { MenuBar } from "../components/MenuBar";
import { MediaPlayerIcon } from "../icons";
import styles from "./MediaPlayer.module.css";

type Props = { path?: string; windowId?: string };

const isMedia = (e: FsEntry) =>
  e.kind === "file" && (e.mime?.startsWith("video/") || e.mime?.startsWith("audio/") || false);

const clock = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/* Windows Media Player 9, or the part of it anyone remembers: the dark blue
 * chrome, the round play button, the playlist down the right-hand side. The
 * <video> element does the work; this is the skin around it.
 *
 * One player, both kinds of file. A video and an MP3 open in the same window
 * in Windows too, and the only difference is what the Now Playing area shows
 * while the sound comes out.
 */
export function MediaPlayer({ path, windowId }: Props) {
  const entries = useFsStore((s) => s.entries);
  const setTitle = useWindowStore((s) => s.setTitle);

  const [current, setCurrent] = useState<string | null>(path ? normalize(path) : null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const media = useRef<HTMLVideoElement>(null);

  const entry = current ? entries[current] : undefined;
  const url = entry && isMedia(entry) ? blobUrlFor(entry) : undefined;
  const isVideo = entry?.mime?.startsWith("video/") ?? false;
  const name = entry ? basename(entry.path) : "";

  /* The playlist is the folder: whatever else is playable next to the file
   * that was opened, in Explorer's order. That is how a folder of clips
   * becomes something you can leave running. */
  const playlist = useMemo(
    () => (current ? listEntries(entries, dirname(current)).filter(isMedia) : []),
    [entries, current]
  );
  const index = playlist.findIndex((e) => e.path === current);

  /* Stable, because the listener effect below depends on it. */
  const play = useCallback((target: string) => {
    setCurrent(target);
    setTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    if (windowId) setTitle(windowId, `${name ? `${name} - ` : ""}Windows Media Player`);
  }, [windowId, name, setTitle]);

  useEffect(() => {
    const el = media.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted, url]);

  /* Native listeners, attached after commit, rather than onPlay and friends
   * as props. The element is created with its src during render and starts
   * loading at once; with a small file already in the cache, `durationchange`
   * and autoplay's `play` can both fire before React has attached anything,
   * and the button then says Play over a picture that is moving. Reading the
   * element's state first covers whatever already happened. */
  useEffect(() => {
    const el = media.current;
    if (!el) return;

    const sync = () => {
      setPlaying(!el.paused);
      setTime(el.currentTime);
      setDuration(el.duration);
    };
    const onEnded = () => {
      const next = playlist[index + 1];
      if (next) play(next.path);
    };
    const onError = () =>
      void errorDialog(
        "Windows Media Player",
        `Windows Media Player cannot play the file.\n\n${name}\n\nThe browser does not support this format, or the file could not be downloaded.`
      );

    sync();
    for (const type of ["play", "pause", "timeupdate", "durationchange", "loadedmetadata"]) {
      el.addEventListener(type, sync);
    }
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      for (const type of ["play", "pause", "timeupdate", "durationchange", "loadedmetadata"]) {
        el.removeEventListener(type, sync);
      }
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, [url, playlist, index, name, play]);

  const togglePlay = () => {
    const el = media.current;
    if (!el || !url) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const stop = () => {
    const el = media.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setTime(0);
  };

  const step = (delta: number) => {
    const next = playlist[index + delta];
    if (next) play(next.path);
  };

  const openFile = async () => {
    const picked = await fileDialog("open", current ? dirname(current) : MY_DOCUMENTS, "");
    if (picked === null) return;
    const target = normalize(picked);
    const chosen = useFsStore.getState().get(target);
    if (!chosen || !isMedia(chosen)) {
      void errorDialog(
        "Windows Media Player",
        `Windows Media Player cannot play the file.\n\n${display(target)}\n\nThe file is not a video or audio file that the player recognizes.`
      );
      return;
    }
    play(target);
  };

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [{ label: "Open...", onClick: () => void openFile() }],
          },
          {
            label: "Play",
            items: [
              { label: playing ? "Pause" : "Play", onClick: togglePlay },
              { label: "Stop", onClick: stop },
              { label: "Previous", onClick: () => step(-1) },
              { label: "Next", onClick: () => step(1) },
            ],
          },
          {
            label: "Help",
            items: [
              {
                label: "About Windows Media Player",
                onClick: () =>
                  void errorDialog(
                    "About Windows Media Player",
                    "funOS Media Player\n\nPlays whatever the browser can decode: MP4, WebM, MP3, OGG, WAV. Files open from the virtual file system or from the portfolio folder on the server."
                  ),
              },
            ],
          },
        ]}
      />

      <div className={styles.body}>
        <div className={styles.stage}>
          {url ? (
            <>
              <video
                key={url}
                ref={media}
                src={url}
                className={isVideo ? styles.video : styles.audioOnly}
                autoPlay
                playsInline
              />
              {!isVideo && (
                /* Ambience, in the spirit of the visualizations: a slow wash
                   under the file name rather than a black rectangle. */
                <div className={styles.ambience}>
                  <MediaPlayerIcon size={64} />
                  <div className={styles.nowPlaying}>{name}</div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.ambience}>
              <MediaPlayerIcon size={64} />
              <div className={styles.nowPlaying}>Open a video or audio file to begin.</div>
            </div>
          )}
        </div>

        <div className={styles.playlist}>
          <div className={styles.playlistHead}>{current ? basename(dirname(current)) : "Playlist"}</div>
          <div className={styles.playlistItems}>
            {playlist.map((item, i) => (
              <button
                key={item.path}
                type="button"
                className={item.path === current ? `${styles.track} ${styles.active}` : styles.track}
                onClick={() => play(item.path)}
                onDoubleClick={() => play(item.path)}
              >
                <span className={styles.trackNo}>{i + 1}</span>
                <span className={styles.trackName}>{basename(item.path)}</span>
              </button>
            ))}
            {playlist.length === 0 && <div className={styles.emptyList}>No items.</div>}
          </div>
        </div>
      </div>

      <div className={styles.seekRow}>
        <input
          type="range"
          className={styles.seek}
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          disabled={!url}
          onChange={(e) => {
            const el = media.current;
            if (!el) return;
            el.currentTime = Number(e.target.value);
          }}
        />
      </div>

      <div className={styles.transport}>
        <button type="button" className={styles.playButton} onClick={togglePlay} disabled={!url} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className={styles.small} onClick={stop} disabled={!url} aria-label="Stop">
          ■
        </button>
        <button type="button" className={styles.small} onClick={() => step(-1)} disabled={index <= 0} aria-label="Previous">
          ⏮
        </button>
        <button type="button" className={styles.small} onClick={() => step(1)} disabled={index < 0 || index >= playlist.length - 1} aria-label="Next">
          ⏭
        </button>
        <button type="button" className={styles.small} onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <input
          type="range"
          className={styles.volume}
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
        <span className={styles.time}>
          {clock(time)} / {clock(duration)}
        </span>
      </div>
    </div>
  );
}
