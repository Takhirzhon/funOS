import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { blobUrlFor, isBinary, useFsStore } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { confirmDialog, errorDialog, fileDialog } from "../store/dialogStore";
import { basename, dirname, display, extname, normalize } from "../fs/path";
import { MY_DOCUMENTS } from "../fs/seed";
import { MenuBar } from "../components/MenuBar";
import styles from "./Paint.module.css";

type Props = { path?: string; windowId?: string };

type Tool = "pencil" | "brush" | "eraser" | "line" | "rect" | "ellipse";

const TOOLS: { id: Tool; label: string; glyph: string }[] = [
  { id: "pencil", label: "Pencil", glyph: "✎" },
  { id: "brush", label: "Brush", glyph: "🖌" },
  { id: "eraser", label: "Eraser", glyph: "▭" },
  { id: "line", label: "Line", glyph: "╱" },
  { id: "rect", label: "Rectangle", glyph: "▢" },
  { id: "ellipse", label: "Ellipse", glyph: "◯" },
];

/* Paint's palette, in its order: greys along the top, colours along the
 * bottom. Being the right colours in the right places is most of why the strip
 * is recognisable at all.
 */
const PALETTE = [
  "#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080",
  "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
  "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff",
  "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040",
];

const SIZES = [1, 3, 5, 8];

const WIDTH = 640;
const HEIGHT = 440;

export function Paint({ path, windowId }: Props) {
  const writeBinary = useFsStore((s) => s.writeBinary);
  const exists = useFsStore((s) => s.exists);
  const setTitle = useWindowStore((s) => s.setTitle);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* Everything is drawn twice: committed strokes live on the visible canvas,
   * and a shape being dragged is previewed by restoring this snapshot and
   * redrawing on top. Without a snapshot, dragging a rectangle would leave a
   * smear of every intermediate rectangle behind it.
   */
  const snapshot = useRef<ImageData | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");
  const [size, setSize] = useState(1);
  const [file, setFile] = useState<string | null>(path ? normalize(path) : null);
  const [dirty, setDirty] = useState(false);

  const name = file ? basename(file) : "untitled";

  useEffect(() => {
    if (windowId) setTitle(windowId, `${dirty ? "*" : ""}${name} - Paint`);
  }, [windowId, name, dirty, setTitle]);

  /* A fresh canvas is white, not transparent. A PNG saved from a transparent
   * canvas looks fine here and black in half the viewers that open it later.
   */
  const context = () => canvasRef.current?.getContext("2d") ?? null;

  const clear = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  };

  useEffect(() => {
    const ctx = context();
    if (!ctx) return;
    clear(ctx);

    if (!path) return;
    const entry = useFsStore.getState().get(path);
    if (!entry || !isBinary(entry)) return;
    const url = blobUrlFor(entry);
    if (!url) return;

    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0);
    };
    image.src = url;
  }, [path]);

  const pointAt = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    /* The canvas is a fixed pixel size and CSS may scale it, so a click has to
     * be converted rather than used directly - otherwise strokes land offset
     * from the cursor by however much it was scaled. */
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * WIDTH),
      y: Math.round(((e.clientY - rect.top) / rect.height) * HEIGHT),
    };
  };

  const strokeStyle = () => (tool === "eraser" ? background : color);

  const beginStroke = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    if (!ctx || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const point = pointAt(e);
    start.current = point;
    snapshot.current = ctx.getImageData(0, 0, WIDTH, HEIGHT);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = tool === "eraser" ? Math.max(size, 6) : size;
    ctx.strokeStyle = strokeStyle();

    if (tool === "pencil" || tool === "brush" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      /* A dot, so a single click marks the canvas. A path with one point and
       * no line draws nothing at all. */
      ctx.lineTo(point.x + 0.01, point.y);
      ctx.stroke();
    }
    setDirty(true);
  };

  const continueStroke = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    if (!ctx || !start.current) return;
    const point = pointAt(e);

    if (tool === "pencil" || tool === "brush" || tool === "eraser") {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      return;
    }

    if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0);
    ctx.beginPath();
    if (tool === "line") {
      ctx.moveTo(start.current.x, start.current.y);
      ctx.lineTo(point.x, point.y);
    } else if (tool === "rect") {
      ctx.rect(
        start.current.x,
        start.current.y,
        point.x - start.current.x,
        point.y - start.current.y
      );
    } else {
      ctx.ellipse(
        (start.current.x + point.x) / 2,
        (start.current.y + point.y) / 2,
        Math.abs(point.x - start.current.x) / 2,
        Math.abs(point.y - start.current.y) / 2,
        0,
        0,
        Math.PI * 2
      );
    }
    ctx.stroke();
  };

  const endStroke = () => {
    start.current = null;
    snapshot.current = null;
  };

  /* ---- File ---------------------------------------------------------------- */

  const toBytes = (): Promise<Uint8Array | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)));
      }, "image/png");
    });

  const saveTo = async (target: string): Promise<boolean> => {
    const bytes = await toBytes();
    if (!bytes) {
      void errorDialog("Paint", "The image could not be encoded.");
      return false;
    }
    if (!writeBinary(target, bytes, "image/png")) {
      void errorDialog("Paint", `Cannot save ${display(target)}.\n\nThe folder does not exist.`);
      return false;
    }
    setFile(target);
    setDirty(false);
    return true;
  };

  const saveAs = async (): Promise<boolean> => {
    const picked = await fileDialog("save", file ? dirname(file) : MY_DOCUMENTS, `${name}.png`);
    if (picked === null) return false;
    const target = extname(picked) ? picked : `${picked}.png`;

    if (target !== file && exists(target)) {
      const ok = await confirmDialog(
        "Save As",
        `${basename(target)} already exists.\nDo you want to replace it?`
      );
      if (!ok) return false;
    }
    return saveTo(target);
  };

  const confirmDiscard = async (): Promise<boolean> => {
    if (!dirty) return true;
    const keep = await confirmDialog(
      "Paint",
      `The image in ${name} has changed.\n\nDo you want to save the changes?`
    );
    if (!keep) return true;
    return file ? saveTo(file) : saveAs();
  };

  const newImage = async () => {
    if (!(await confirmDiscard())) return;
    const ctx = context();
    if (ctx) clear(ctx);
    setFile(null);
    setDirty(false);
  };

  const openImage = async () => {
    if (!(await confirmDiscard())) return;
    const picked = await fileDialog(
      "open",
      file ? dirname(file) : MY_DOCUMENTS,
      file ? basename(file) : ""
    );
    if (picked === null) return;

    const entry = useFsStore.getState().get(normalize(picked));
    if (!entry || !isBinary(entry) || !entry.mime?.startsWith("image/")) {
      void errorDialog("Paint", `${display(picked)}\n\nPaint cannot read this file.`);
      return;
    }
    const url = blobUrlFor(entry);
    const ctx = context();
    if (!url || !ctx) return;

    const image = new Image();
    image.onload = () => {
      clear(ctx);
      ctx.drawImage(image, 0, 0);
      setFile(normalize(picked));
      setDirty(false);
    };
    image.src = url;
  };

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [
              { label: "New", onClick: () => void newImage() },
              { label: "Open...", onClick: () => void openImage() },
              { label: "Save", onClick: () => void (file ? saveTo(file) : saveAs()) },
              { label: "Save As...", onClick: () => void saveAs() },
            ],
          },
          {
            label: "Image",
            items: [
              {
                label: "Clear Image",
                onClick: () => {
                  const ctx = context();
                  if (ctx) clear(ctx);
                  setDirty(true);
                },
              },
            ],
          },
        ]}
      />

      <div className={styles.main}>
        <div className={styles.tools}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              className={tool === t.id ? `${styles.tool} ${styles.active}` : styles.tool}
              onClick={() => setTool(t.id)}
            >
              {t.glyph}
            </button>
          ))}
        </div>

        <div className={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={beginStroke}
            onPointerMove={continueStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
        </div>
      </div>

      <div className={styles.palette}>
        <div className={styles.current}>
          <span className={styles.currentBack} style={{ background }} />
          <span className={styles.currentFront} style={{ background: color }} />
        </div>

        <div className={styles.swatches}>
          {PALETTE.map((swatch, index) => (
            <button
              key={`${swatch}-${index}`}
              type="button"
              className={styles.swatch}
              style={{ background: swatch }}
              title={swatch}
              onClick={() => setColor(swatch)}
              /* Right-click sets the background colour, which is what the
               * eraser paints with - exactly as it does in Paint. */
              onContextMenu={(e) => {
                e.preventDefault();
                setBackground(swatch);
              }}
            />
          ))}
        </div>

        <div className={styles.sizes}>
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              title={`${s}px`}
              className={size === s ? `${styles.size} ${styles.active}` : styles.size}
              onClick={() => setSize(s)}
            >
              <span className={styles.dot} style={{ width: s + 1, height: s + 1 }} />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.status}>
        <span>{file ? display(file) : "Untitled"}</span>
        <span>
          {WIDTH} × {HEIGHT}
          {dirty ? " — unsaved" : ""}
        </span>
      </div>
    </div>
  );
}
