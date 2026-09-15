import { useEffect, useRef } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  AmbientLight,
  LinearFilter,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { cv } from "virtual:portfolio";

/* 3D Text, on three.js - the screensaver that said whose computer it was.
 *
 * The original extruded a TrueType outline and spun it; that needs a font
 * file, and a typeface JSON for three.js is 60KB of a single face. This
 * draws the text on a canvas instead and wraps a slab in it: the front and
 * back carry the letters, the four sides are the extrusion colour, and from
 * a distance with a light on it that is what extruded text looked like at
 * 800x600. Same trick as the maze's bricks - drawn, not downloaded.
 *
 * The slab tumbles on two axes and drifts about the screen, bouncing off
 * the edges, which is the whole choreography of the original.
 */

const TEXT = cv.name;

function textTexture(): { texture: CanvasTexture; aspect: number } {
  const canvas = document.createElement("canvas");
  const font = "bold 96px Tahoma, Verdana, sans-serif";
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(TEXT).width) + 64;
  canvas.width = width;
  canvas.height = 160;
  ctx.font = font;
  ctx.fillStyle = "#1c3f7a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(TEXT, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  return { texture, aspect: canvas.width / canvas.height };
}

export function Text3D({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true });
    } catch {
      /* No WebGL. Black, like the maze. */
      return;
    }

    const scene = new Scene();
    scene.background = new Color("#000");
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 14;

    const { texture, aspect } = textTexture();
    const face = new MeshLambertMaterial({ map: texture });
    const side = new MeshLambertMaterial({ color: "#f5a623" });
    /* BoxGeometry's material order: +x, -x, +y, -y, +z, -z. Front and back
     * get the letters, the rest the extrusion. Unit height; the size on
     * screen is set from the view in resize(), so the same slab fits a
     * 150px preview and a 4K monitor. */
    const slab = new Mesh(new BoxGeometry(aspect, 1, 0.14), [side, side, side, side, face, face]);
    scene.add(slab);

    scene.add(new AmbientLight("#ffffff", 0.9));
    const light = new DirectionalLight("#ffffff", 1.6);
    light.position.set(4, 6, 10);
    scene.add(light);

    let x = 0;
    let y = 0;
    let dx = 0.018;
    let dy = 0.012;
    let bounds = { x: 1, y: 1 };

    const resize = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      /* The view at the slab's distance, from the field of view. The text
       * takes a bit over half the width - or less, on a tall screen, so it
       * never grows past a third of the height - and can wander until its
       * turning circle touches the edge. */
      const halfH = Math.tan((camera.fov / 2) * (Math.PI / 180)) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const scale = Math.min((halfW * 2 * 0.55) / aspect, halfH * 2 * 0.3);
      slab.scale.setScalar(scale);
      const reach = (scale * aspect) / 2;
      bounds = { x: Math.max(0.1, halfW - reach), y: Math.max(0.1, halfH - reach * 0.45) };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let raf = 0;
    const tick = () => {
      slab.rotation.y += 0.012;
      slab.rotation.x = Math.sin(slab.rotation.y * 0.7) * 0.35;
      x += dx;
      y += dy;
      if (x > bounds.x || x < -bounds.x) dx = -dx;
      if (y > bounds.y || y < -bounds.y) dy = -dy;
      slab.position.set(x, y, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      slab.geometry.dispose();
      texture.dispose();
      face.dispose();
      side.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className={className} />;
}
