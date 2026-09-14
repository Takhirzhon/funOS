import { useEffect, useRef, useState } from "react";
import { useThemeStore, type Saver } from "../store/themeStore";
import { useSessionStore } from "../store/sessionStore";
import styles from "./ScreenSaver.module.css";

/* Three screensavers on one canvas, and the idle timer that starts them.
 *
 * 3D Maze is on the roadmap and is not here: it needs a raycaster and a texture
 * set, and a flat approximation of it would be a different program wearing its
 * name. Mystify takes its place - also an XP screensaver, also unmistakable,
 * and honestly buildable in thirty lines.
 */

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

/* --- Starfield ---------------------------------------------------------------
 * Stars are held in 3D and projected each frame. The alternative - moving 2D
 * dots outward - looks like a firework rather than like flying, because the
 * speed of a real star depends on how close it is.
 */
type Star = { x: number; y: number; z: number };
let stars: Star[] = [];

const starfield: Draw = (ctx, w, h) => {
  if (stars.length === 0) {
    stars = Array.from({ length: 320 }, () => ({
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 2000,
      z: Math.random() * 1000 + 1,
    }));
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  for (const star of stars) {
    star.z -= 6;
    if (star.z <= 1) {
      star.x = (Math.random() - 0.5) * 2000;
      star.y = (Math.random() - 0.5) * 2000;
      star.z = 1000;
    }
    const k = 320 / star.z;
    const px = w / 2 + star.x * k;
    const py = h / 2 + star.y * k;
    if (px < 0 || px >= w || py < 0 || py >= h) continue;
    /* Nearer stars are bigger and brighter, which is the entire illusion. */
    const size = (1 - star.z / 1000) * 2.6;
    ctx.fillStyle = `rgba(255,255,255,${1 - star.z / 1000})`;
    ctx.fillRect(px, py, size, size);
  }
};

/* --- Pipes -------------------------------------------------------------------
 * Not a real 3D scene: a pipe walking a grid, drawn with a lighter core line
 * over a darker one so each segment reads as a tube rather than as a stroke.
 */
type Pipe = { x: number; y: number; dx: number; dy: number; hue: number; life: number };
let pipes: Pipe[] = [];

const CELL = 22;

const pipesDraw: Draw = (ctx, w, h, t) => {
  if (t === 0) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    pipes = [];
  }
  if (pipes.length < 3 && Math.random() < 0.05) {
    pipes.push({
      x: Math.round(Math.random() * (w / CELL)) * CELL,
      y: Math.round(Math.random() * (h / CELL)) * CELL,
      dx: 1,
      dy: 0,
      hue: Math.floor(Math.random() * 360),
      life: 0,
    });
  }

  for (const pipe of pipes) {
    /* Turns happen on the grid, so the pipe always meets itself squarely -
     * a turn at an arbitrary point looks like a kink rather than an elbow. */
    if (Math.random() < 0.18) {
      const turn = Math.random() < 0.5 ? 1 : -1;
      [pipe.dx, pipe.dy] = [-pipe.dy * turn, pipe.dx * turn];
    }
    const nx = pipe.x + pipe.dx * CELL;
    const ny = pipe.y + pipe.dy * CELL;

    ctx.lineCap = "round";
    ctx.strokeStyle = `hsl(${pipe.hue} 70% 28%)`;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(pipe.x, pipe.y);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    ctx.strokeStyle = `hsl(${pipe.hue} 80% 62%)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pipe.x, pipe.y);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    pipe.x = ((nx % w) + w) % w;
    pipe.y = ((ny % h) + h) % h;
    pipe.life += 1;
  }
  pipes = pipes.filter((p) => p.life < 900);
};

/* --- Mystify ------------------------------------------------------------------ */
type Corner = { x: number; y: number; dx: number; dy: number };
let shape: Corner[] = [];
const TRAIL = 14;
let history: Corner[][] = [];

const mystify: Draw = (ctx, w, h, t) => {
  if (t === 0 || shape.length === 0) {
    shape = Array.from({ length: 4 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
    }));
    history = [];
  }

  for (const corner of shape) {
    corner.x += corner.dx;
    corner.y += corner.dy;
    /* Bounce by reflecting, not by wrapping. A corner that teleports across
     * the screen drags the whole polygon with it and the shape snaps. */
    if (corner.x < 0 || corner.x > w) corner.dx *= -1;
    if (corner.y < 0 || corner.y > h) corner.dy *= -1;
  }

  history.push(shape.map((c) => ({ ...c })));
  if (history.length > TRAIL) history.shift();

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  history.forEach((frame, index) => {
    const age = index / history.length;
    ctx.strokeStyle = `hsl(${(t * 0.4 + index * 12) % 360} 85% ${30 + age * 40}%)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    frame.forEach((corner, i) => {
      if (i === 0) ctx.moveTo(corner.x, corner.y);
      else ctx.lineTo(corner.x, corner.y);
    });
    ctx.closePath();
    ctx.stroke();
  });
};

const DRAWERS: Record<Exclude<Saver, "none">, Draw> = {
  starfield,
  pipes: pipesDraw,
  mystify,
};

/** The canvas itself, also used by the Display Properties preview. */
export function SaverCanvas({ saver, className }: { saver: Saver; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || saver === "none") return;

    /* Sized from the element rather than from the window: the same component
     * runs full screen and inside a 150px preview. */
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let frame = 0;
    let raf = 0;
    const tick = () => {
      DRAWERS[saver](ctx, canvas.width, canvas.height, frame);
      frame += 1;
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [saver]);

  if (saver === "none") return <div className={className} style={{ background: "#000" }} />;
  return <canvas ref={ref} className={className} />;
}

export function ScreenSaver() {
  const saver = useThemeStore((s) => s.saver);
  const idleMinutes = useThemeStore((s) => s.idleMinutes);
  const phase = useSessionStore((s) => s.phase);
  const [active, setActive] = useState(false);

  /* The idle timer is reset from a listener rather than from React state, so
   * moving the mouse does not re-render the whole desktop sixty times a second
   * just to say "still here".
   */
  useEffect(() => {
    if (saver === "none" || phase !== "desktop") return;

    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setActive(true), idleMinutes * 60_000);
    };

    const wake = () => {
      setActive((was) => {
        if (was) return false;
        return was;
      });
      arm();
    };

    const events = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) window.addEventListener(name, wake, { passive: true });
    arm();

    return () => {
      clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, wake);
    };
  }, [saver, idleMinutes, phase]);

  if (!active || saver === "none") return null;

  return (
    <div className={styles.overlay}>
      <SaverCanvas saver={saver} className={styles.canvas} />
    </div>
  );
}
