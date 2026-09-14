import { create } from "zustand";

/* Sound, synthesized rather than shipped.
 *
 * The XP sound scheme is Microsoft's, it is several hundred KB of WAV, and the
 * first-paint budget is already mostly a photograph. Web Audio makes a
 * convincing startup chime out of four sine waves and about forty lines, and
 * the file it costs is this one.
 *
 * Muted by default, and not only out of politeness: browsers refuse to start an
 * AudioContext before the page has been interacted with. A desktop that tried
 * to play a chime at load would print a console warning and nothing else, so
 * the first gesture is what creates the context - and on this desktop the first
 * gesture is clicking the user tile to log in, which is exactly when the chime
 * should play anyway.
 */
type Voice = "startup" | "ding" | "click" | "shutdown";

const ENABLED_KEY = "funos.sound";

const loadEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
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

type Note = { freq: number; at: number; length: number; gain: number; type?: OscillatorType };

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
  ding: [
    { freq: 987.77, at: 0, length: 0.35, gain: 0.12 },
    { freq: 1318.51, at: 0.02, length: 0.3, gain: 0.07 },
  ],
  click: [{ freq: 2200, at: 0, length: 0.03, gain: 0.04, type: "square" }],
};

type SoundStore = {
  enabled: boolean;
  toggle: () => void;
  play: (voice: Voice) => void;
};

export const useSoundStore = create<SoundStore>((set, get) => ({
  enabled: loadEnabled(),

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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type ?? "triangle";
      osc.frequency.value = note.freq;

      /* An envelope, not a bare on/off. A square-edged note clicks at both
       * ends, and the click is louder than the note. */
      const start = now + note.at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.gain, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.length);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.length + 0.05);
    }
  },
}));

/** For code outside React - the shell's dialogs and the session machine. */
export const playSound = (voice: Voice) => useSoundStore.getState().play(voice);
