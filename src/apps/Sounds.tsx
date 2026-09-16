import { useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { useSoundStore, VOICE_EVENTS, type Voice } from "../store/soundStore";
import { AudioDevicesIcon, VolumeIcon, VolumeMuteIcon } from "../icons";
import styles from "./Sounds.module.css";

type Props = { windowId?: string };
type Tab = "volume" | "sounds";

/* Sounds and Audio Devices Properties: the Volume tab with its slider and
 * Mute box, and the Sounds tab with the scheme and the list of program
 * events, each with a Play button - which is how everyone found out what
 * "Critical Stop" sounded like. Two schemes, because there are two: the
 * sounds, and no sounds. */
export function Sounds({ windowId }: Props) {
  const close = useWindowStore((s) => s.close);
  const enabled = useSoundStore((s) => s.enabled);
  const volume = useSoundStore((s) => s.volume);
  const setEnabled = useSoundStore((s) => s.setEnabled);
  const setVolume = useSoundStore((s) => s.setVolume);
  const play = useSoundStore((s) => s.play);
  const [tab, setTab] = useState<Tab>("volume");
  const [selected, setSelected] = useState<Voice>("startup");

  const done = () => windowId && close(windowId);

  return (
    <div className={styles.app}>
      <div className={styles.tabs}>
        <button type="button" className={tab === "volume" ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab("volume")}>
          Volume
        </button>
        <button type="button" className={tab === "sounds" ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab("sounds")}>
          Sounds
        </button>
        <span className={styles.tab}>Audio</span>
        <span className={styles.tab}>Voice</span>
        <span className={styles.tab}>Hardware</span>
      </div>

      <div className={styles.page}>
        {tab === "volume" && (
          <>
            <div className={styles.device}>
              <AudioDevicesIcon size={32} />
              <span>Web Audio (your browser)</span>
            </div>
            <fieldset className={styles.group}>
              <legend>Device volume</legend>
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Low</span>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  onMouseUp={() => enabled && play("ding")}
                  aria-label="Device volume"
                />
                <span className={styles.sliderLabel}>High</span>
              </div>
              <div className={styles.check}>
                <input type="checkbox" id="snd-mute" checked={!enabled} onChange={(e) => setEnabled(!e.target.checked)} />
                <label htmlFor="snd-mute">Mute</label>
              </div>
              <div className={styles.check}>
                <input type="checkbox" id="snd-tray" checked readOnly disabled />
                <label htmlFor="snd-tray">Place volume icon in the taskbar</label>
              </div>
            </fieldset>
            <fieldset className={styles.group}>
              <legend>Speaker settings</legend>
              <p className={styles.blurb}>
                Every sound here is synthesized from a few sine waves when it is played &mdash; there is no audio
                file in this build. The speaker in the notification area is the same switch as Mute.
              </p>
            </fieldset>
          </>
        )}

        {tab === "sounds" && (
          <>
            <p className={styles.blurb}>
              A sound scheme is a set of sounds applied to events in Windows and programs. You can select an
              existing scheme or save one you have modified.
            </p>
            <label className={styles.field}>
              <span>Sound scheme:</span>
              <select value={enabled ? "default" : "none"} onChange={(e) => setEnabled(e.target.value === "default")}>
                <option value="default">Windows Default</option>
                <option value="none">No Sounds</option>
              </select>
            </label>
            <div className={styles.eventsHead}>Program events:</div>
            <div className={styles.events}>
              <div className={styles.eventGroup}>Windows</div>
              {(Object.keys(VOICE_EVENTS) as Voice[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={selected === v ? `${styles.event} ${styles.eventCurrent}` : styles.event}
                  onClick={() => setSelected(v)}
                  onDoubleClick={() => play(v)}
                >
                  {enabled ? <VolumeIcon /> : <VolumeMuteIcon />}
                  {VOICE_EVENTS[v]}
                </button>
              ))}
            </div>
            <div className={styles.soundRow}>
              <span>Sounds:</span>
              <select value={enabled ? "synth" : "none"} disabled>
                <option value="synth">{selected}.wav (synthesized)</option>
                <option value="none">(None)</option>
              </select>
              <button type="button" onClick={() => play(selected)} disabled={!enabled} title="Play">
                &#9654;
              </button>
              <button type="button" disabled>
                Browse...
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" onClick={done} autoFocus>
          OK
        </button>
        <button type="button" onClick={done}>
          Cancel
        </button>
        <button type="button" disabled>
          Apply
        </button>
      </div>
    </div>
  );
}
