import { useEffect, useRef } from "react";

/* The visualization - "Bars", the one Media Player 9 opened with: a row of
 * green-to-yellow bars on black that jump to the music, over a slower
 * afterimage that lets them fall.
 *
 * Web Audio's AnalyserNode does the listening. One AudioContext for the
 * page, one source per media element and never a second - the browser
 * allows exactly one createMediaElementSource per element, and a second
 * throws - so the sources are remembered per element in a WeakMap. Wired
 * through to the destination, or routing the element into the graph would
 * mute it. The context starts suspended until a gesture; the double-click
 * that opened the file is that gesture, and play() resumes it.
 */

let context: AudioContext | null = null;
const sources = new WeakMap<HTMLMediaElement, { source: MediaElementAudioSourceNode; analyser: AnalyserNode }>();

function analyserFor(el: HTMLMediaElement): AnalyserNode | null {
  try {
    context ??= new AudioContext();
    let wired = sources.get(el);
    if (!wired) {
      const source = context.createMediaElementSource(el);
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(context.destination);
      wired = { source, analyser };
      sources.set(el, wired);
    }
    if (context.state === "suspended") void context.resume();
    return wired.analyser;
  } catch {
    /* No Web Audio, or a cross-origin file the graph may not read. The
     * ambience underneath stays; nothing else is lost. */
    return null;
  }
}

export function Visualizer({ media, className }: { media: HTMLMediaElement | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !media) return;
    const analyser = analyserFor(media);
    if (!analyser) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    const peaks = new Float32Array(analyser.frequencyBinCount);
    let raf = 0;

    const draw = () => {
      const w = (canvas.width = canvas.clientWidth);
      const h = (canvas.height = canvas.clientHeight);
      analyser.getByteFrequencyData(bins);

      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 0, w, h);

      /* The lowest bins carry most of the music; the top third of the
       * spectrum is usually silence at these bitrates, so it is left out
       * and the rest spreads across the width. */
      const shown = Math.floor(bins.length * 0.7);
      const gap = 2;
      const bw = Math.max(2, (w - gap * (shown - 1)) / shown);
      for (let i = 0; i < shown; i++) {
        const v = bins[i] / 255;
        const bh = v * (h - 6);
        const x = i * (bw + gap);
        const grad = ctx.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, "#1d9a1d");
        grad.addColorStop(0.7, "#9be31c");
        grad.addColorStop(1, "#ffe45c");
        ctx.fillStyle = grad;
        ctx.fillRect(x, h - bh, bw, bh);

        /* The peak marker, which falls slower than the bar. */
        peaks[i] = Math.max(bh, peaks[i] - 1.2);
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, h - peaks[i] - 2, bw, 2);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [media]);

  return <canvas ref={ref} className={className} />;
}
