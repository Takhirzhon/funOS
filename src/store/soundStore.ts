import { create } from "zustand";

/* Sound, synthesized rather than shipped.
 *
 * The XP sound scheme is Microsoft's, it is several hundred KB of WAV, and the
 * first-paint budget is already mostly a photograph. Web Audio makes a
 * convincing startup chime out of four sine waves and about forty lines, and
 * the file it costs is this one.
 *
 * On by default, as XP's was; the speaker in the tray turns it off. Browsers
 * refuse to start an AudioContext before the page has been interacted with,
 * so the first gesture is what creates the context - and on this desktop the
 * first gesture is clicking the user tile to log in, which is exactly when
 * the chime should play anyway.
 */
export type Voice =
  | "startup"
  | "shutdown"
  | "logoff"
  | "ding"
  | "critical"
  | "exclamation"
  | "notify"
  | "click"
  | "minimize"
  | "restore"
  | "recycle"
  | "menu"
  | "card"
  | "boom"
  | "tada";

/** What each voice is called in Sounds and Audio Devices' event list. */
export const VOICE_EVENTS: Record<Voice, string> = {
  startup: "Start Windows",
  shutdown: "Exit Windows",
  logoff: "Log Off Windows",
  ding: "Default Beep",
  critical: "Critical Stop",
  exclamation: "Exclamation",
  notify: "System Notification",
  click: "Start Navigation",
  minimize: "Minimize",
  restore: "Restore Up",
  recycle: "Empty Recycle Bin",
  menu: "Menu Popup",
  card: "Solitaire: Card",
  boom: "Minesweeper: Mine",
  tada: "Minesweeper: Won",
};

const ENABLED_KEY = "funos.sound";
const VOLUME_KEY = "funos.sound.volume";

const loadVolume = (): number => {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
};

const loadEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
};

let context: AudioContext | null = null;

/* Created lazily and kept. Making one per sound leaks: browsers cap the number
 * of live AudioContexts per page at around six, and the seventh throws.
 */
function audio(): AudioContext | null {
  if (context) return context;
  try {
    context = new AudioContext();
  } catch {
    return null;
  }
  return context;
}

type Note = {
  freq: number;
  at: number;
  length: number;
  gain: number;
  type?: OscillatorType;
  /** Slides to this pitch over the note's length: the swoosh of a window going down. */
  to?: number;
  /** White noise through a band around `freq` instead of a tone: paper crumpling. */
  noise?: boolean;
};

/* The startup chime is four notes over a low pad: a rising third, a fifth, and
 * the octave. It is not the real one - it is the shape of the real one, which
 * is what the ear actually recognises.
 */
const VOICES: Record<Voice, Note[]> = {
  startup: [
    { freq: 293.66, at: 0, length: 1.6, gain: 0.05, type: "sine" },
    { freq: 587.33, at: 0.0, length: 0.5, gain: 0.11 },
    { freq: 740.0, at: 0.16, length: 0.5, gain: 0.1 },
    { freq: 880.0, at: 0.32, length: 0.6, gain: 0.1 },
    { freq: 1174.66, at: 0.52, length: 0.9, gain: 0.08 },
  ],
  shutdown: [
    { freq: 880.0, at: 0, length: 0.5, gain: 0.09 },
    { freq: 659.25, at: 0.18, length: 0.5, gain: 0.09 },
    { freq: 440.0, at: 0.36, length: 0.9, gain: 0.09 },
  ],
  /* Log Off is Exit Windows' little sibling: the same fall, quicker. */
  logoff: [
    { freq: 659.25, at: 0, length: 0.3, gain: 0.09 },
    { freq: 523.25, at: 0.14, length: 0.3, gain: 0.09 },
    { freq: 392.0, at: 0.28, length: 0.6, gain: 0.08 },
  ],
  ding: [
    { freq: 987.77, at: 0, length: 0.35, gain: 0.12 },
    { freq: 1318.51, at: 0.02, length: 0.3, gain: 0.07 },
  ],
  /* Critical Stop is two low knocks, the sound of a red X. Nothing else on
   * the desktop is this low, which is the point: you know it is an error
   * with the window still behind another one. */
  critical: [
    { freq: 196.0, at: 0, length: 0.16, gain: 0.16 },
    { freq: 130.81, at: 0.14, length: 0.42, gain: 0.16 },
  ],
  /* Exclamation: a short rise. Something to look at, not something wrong. */
  exclamation: [
    { freq: 587.33, at: 0, length: 0.14, gain: 0.11 },
    { freq: 880.0, at: 0.12, length: 0.3, gain: 0.1 },
  ],
  /* The balloon's two-note chime, up and away. */
  notify: [
    { freq: 1046.5, at: 0, length: 0.14, gain: 0.07 },
    { freq: 1318.51, at: 0.1, length: 0.3, gain: 0.07 },
  ],
  /* Start Navigation: the click with a knock under it, the sound of a
   * folder opening. It was too quiet to hear as one short square wave. */
  click: [
    { freq: 1400, at: 0, length: 0.05, gain: 0.12 },
    { freq: 260, to: 120, at: 0, length: 0.07, gain: 0.16, type: "sine" },
  ],
  /* The Start menu and a context menu: the click without the knock. */
  menu: [{ freq: 1800, at: 0, length: 0.03, gain: 0.07 }],
  /* A card put down: a slap of paper, forty milliseconds. */
  card: [
    { freq: 2400, at: 0, length: 0.04, gain: 0.2, noise: true },
    { freq: 500, at: 0, length: 0.05, gain: 0.08, noise: true },
  ],
  /* A mine: a thump and a burst of rubble. */
  boom: [
    { freq: 90, to: 40, at: 0, length: 0.5, gain: 0.3, type: "sine" },
    { freq: 300, at: 0, length: 0.35, gain: 0.25, noise: true },
    { freq: 1200, at: 0.02, length: 0.2, gain: 0.12, noise: true },
  ],
  /* Won: three notes up and one to hold. */
  tada: [
    { freq: 523.25, at: 0, length: 0.14, gain: 0.1 },
    { freq: 659.25, at: 0.12, length: 0.14, gain: 0.1 },
    { freq: 783.99, at: 0.24, length: 0.14, gain: 0.1 },
    { freq: 1046.5, at: 0.36, length: 0.6, gain: 0.11 },
  ],
  /* Minimize and Restore Up are the same swoosh, one falling, one rising. */
  minimize: [{ freq: 900, to: 260, at: 0, length: 0.14, gain: 0.05, type: "sine" }],
  restore: [{ freq: 260, to: 900, at: 0, length: 0.14, gain: 0.05, type: "sine" }],
  /* Paper going into a wastebasket: a burst of noise with a bit of a crunch. */
  recycle: [
    { freq: 1800, at: 0, length: 0.12, gain: 0.12, noise: true },
    { freq: 900, at: 0.08, length: 0.22, gain: 0.1, noise: true },
  ],
};

let noiseBuffer: AudioBuffer | null = null;

/** A second of white noise, made once. */
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

type SoundStore = {
  enabled: boolean;
  /** 0..1, the Volume tab's slider, multiplied into every note. */
  volume: number;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  play: (voice: Voice) => void;
};

export const useSoundStore = create<SoundStore>((set, get) => ({
  enabled: loadEnabled(),
  volume: loadVolume(),

  setEnabled: (enabled) => {
    if (get().enabled === enabled) return;
    get().toggle();
  },

  setVolume: (volume) => {
    const v = Math.max(0, Math.min(1, volume));
    set({ volume: v });
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* Private mode. */
    }
  },

  toggle: () =>
    set((s) => {
      const enabled = !s.enabled;
      try {
        localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
      } catch {
        /* Private mode. The setting lasts the session. */
      }
      return { enabled };
    }),

  play: (voice) => {
    if (!get().enabled) return;
    const ctx = audio();
    if (!ctx) return;
    /* Suspended is the normal state for a context created before any gesture;
     * resuming is a no-op once it is already running. */
    void ctx.resume();

    const now = ctx.currentTime;
    for (const note of VOICES[voice]) {
      const gain = ctx.createGain();
      const start = now + note.at;

      /* An envelope, not a bare on/off. A square-edged note clicks at both
       * ends, and the click is louder than the note. */
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.gain * get().volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.length);
      gain.connect(ctx.destination);

      if (note.noise) {
        const src = ctx.createBufferSource();
        src.buffer = noise(ctx);
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = note.freq;
        band.Q.value = 0.7;
        src.connect(band).connect(gain);
        src.start(start);
        src.stop(start + note.length + 0.05);
        continue;
      }

      const osc = ctx.createOscillator();
      osc.type = note.type ?? "triangle";
      osc.frequency.setValueAtTime(note.freq, start);
      if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, start + note.length);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + note.length + 0.05);
    }
  },
}));

/** For code outside React - the shell's dialogs and the session machine. */
export const playSound = (voice: Voice) => useSoundStore.getState().play(voice);
