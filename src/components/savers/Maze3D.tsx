import { useEffect, useRef } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  WebGLRenderer,
} from "three";

/* 3D Maze, on three.js.
 *
 * The library is ~150KB gzipped, which is why this lives in its own lazy chunk
 * and why the per-chunk budget in ci.yml carries an exemption for it: nobody
 * downloads a screensaver they have not chosen, and first paint never sees it.
 * A hand-written raycaster would have cost 3KB and looked like a raycaster.
 *
 * Every texture is drawn here rather than fetched. The original's brick walls
 * and the rat on the wall are 64x64 bitmaps; generating them on a canvas costs
 * nothing to download, and NearestFilter keeps them crunchy at close range the
 * way a 1995 texture actually was - bilinear smoothing is what makes a
 * reproduction look like a modern game wearing a costume.
 */

const SIZE = 11; // odd, so the carved maze has a wall border all the way round
const CELL = 4;
const WALL_H = 3;

/** Recursive backtracker on a grid of odd coordinates. */
function carve(): boolean[][] {
  /* true = wall. Starts solid and is dug out, which is the shape the algorithm
   * wants - the alternative, adding walls, needs a second pass to close the
   * gaps it leaves. */
  const grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => true));
  const stack: [number, number][] = [[1, 1]];
  grid[1][1] = false;

  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    const options: [number, number][] = [];
    for (const [dx, dy] of [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0],
    ] as [number, number][]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && ny > 0 && nx < SIZE - 1 && ny < SIZE - 1 && grid[ny][nx]) {
        options.push([nx, ny]);
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny] = options[Math.floor(Math.random() * options.length)];
    grid[(y + ny) / 2][(x + nx) / 2] = false;
    grid[ny][nx] = false;
    stack.push([nx, ny]);
  }
  return grid;
}

/* A brick texture, drawn once. Mortar, then rows of bricks offset by half a
 * brick on alternate courses, then a little per-brick shading - without the
 * shading it reads as wallpaper rather than as masonry.
 */
function brickTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#6b5140";
    ctx.fillRect(0, 0, 64, 64);
    for (let row = 0; row < 4; row += 1) {
      for (let col = -1; col < 3; col += 1) {
        const x = col * 32 + (row % 2 === 0 ? 0 : 16);
        const y = row * 16;
        const shade = 150 + Math.floor(Math.random() * 40);
        ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.52)}, ${Math.floor(shade * 0.38)})`;
        ctx.fillRect(x + 1, y + 1, 30, 14);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function flatTexture(color: string, accent: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = accent;
    for (let i = 0; i < 40; i += 1) {
      ctx.fillRect(Math.random() * 32, Math.random() * 32, 2, 2);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(SIZE * 2, SIZE * 2);
  return texture;
}

export function Maze3D({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: false });
    } catch {
      /* No WebGL - a locked-down browser, or a machine with it disabled. The
       * screensaver stays black rather than throwing inside an effect. */
      return;
    }

    const scene = new Scene();
    const camera = new PerspectiveCamera(72, 1, 0.1, 200);

    const grid = carve();
    const wallGeometry = new BoxGeometry(CELL, WALL_H, CELL);
    const wallMaterial = new MeshBasicMaterial({ map: brickTexture() });

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (!grid[y][x]) continue;
        const wall = new Mesh(wallGeometry, wallMaterial);
        wall.position.set(x * CELL, WALL_H / 2, y * CELL);
        scene.add(wall);
      }
    }

    const span = SIZE * CELL;
    const floor = new Mesh(
      new PlaneGeometry(span * 2, span * 2),
      new MeshBasicMaterial({ map: flatTexture("#2f4f2f", "#3c5f3c") })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(span / 2, 0, span / 2);
    scene.add(floor);

    const ceiling = new Mesh(
      new PlaneGeometry(span * 2, span * 2),
      new MeshBasicMaterial({ map: flatTexture("#3a3a5a", "#4a4a6e") })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(span / 2, WALL_H, span / 2);
    scene.add(ceiling);

    /* The walk.
     *
     * The camera follows the maze rather than flying through it: it moves cell
     * to cell and turns at junctions, preferring to keep going and turning
     * left before right when it cannot. That "always turn the same way first"
     * rule is why the original never looks like it is wandering randomly - it
     * is a wall-follower, and a wall-follower has a rhythm.
     */
    let cx = 1;
    let cy = 1;
    let dir = 1; // 0 up, 1 right, 2 down, 3 left
    const DIRS: [number, number][] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];

    let travelled = 0;
    let nextX = cx;
    let nextY = cy;
    let turning = 0;
    let fromAngle = 0;
    let toAngle = 0;

    const angleOf = (d: number) => -d * (Math.PI / 2);

    const pickNext = () => {
      const order = [dir, (dir + 3) % 4, (dir + 1) % 4, (dir + 2) % 4];
      for (const candidate of order) {
        const [dx, dy] = DIRS[candidate];
        if (!grid[cy + dy][cx + dx]) {
          if (candidate !== dir) {
            fromAngle = angleOf(dir);
            toAngle = angleOf(candidate);
            /* Shortest way round, so a left turn never spins 270 degrees. */
            while (toAngle - fromAngle > Math.PI) toAngle -= Math.PI * 2;
            while (toAngle - fromAngle < -Math.PI) toAngle += Math.PI * 2;
            turning = 1;
          }
          dir = candidate;
          nextX = cx + dx;
          nextY = cy + dy;
          return;
        }
      }
    };
    pickNext();

    const resize = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let raf = 0;
    const tick = () => {
      if (turning > 0) {
        turning = Math.max(0, turning - 0.05);
        camera.rotation.y = toAngle + (fromAngle - toAngle) * turning;
      } else {
        travelled = Math.min(1, travelled + 0.014);
        camera.rotation.y = angleOf(dir);
        camera.position.set(
          (cx + (nextX - cx) * travelled) * CELL,
          WALL_H * 0.5,
          (cy + (nextY - cy) * travelled) * CELL
        );
        if (travelled >= 1) {
          cx = nextX;
          cy = nextY;
          travelled = 0;
          pickNext();
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      /* Three keeps GPU resources until told otherwise, and a screensaver that
       * starts and stops all day would leak a maze each time. */
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const material = object.material as MeshBasicMaterial;
          material.map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className={className} />;
}
