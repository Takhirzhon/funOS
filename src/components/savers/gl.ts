/* The WebGL screensavers, behind one dynamic import.
 *
 * three.js is ~130KB gzipped. Two lazy imports that each pulled it in would
 * hand Rollup a shared module to split into its own chunk - which is exactly
 * the chunk the per-app budget in ci.yml would then measure and fail. One
 * entry point means one chunk, `gl-*.js`, which ci.yml measures separately
 * as the exemption it is. Add a saver that uses three.js here, not to
 * ScreenSaver.tsx directly.
 */
export { Maze3D } from "./Maze3D";
export { Text3D } from "./Text3D";
