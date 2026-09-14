import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { MenuBar } from "../components/MenuBar";
import styles from "./Minesweeper.module.css";

type Level = { name: string; cols: number; rows: number; mines: number };

const LEVELS: Level[] = [
  { name: "Beginner", cols: 9, rows: 9, mines: 10 },
  { name: "Intermediate", cols: 16, rows: 16, mines: 40 },
  { name: "Expert", cols: 30, rows: 16, mines: 99 },
];

type Cell = {
  mine: boolean;
  /** Adjacent mine count, filled in with the mines. */
  near: number;
  open: boolean;
  flag: boolean;
};

type Status = "ready" | "playing" | "won" | "lost";

const makeBoard = (level: Level): Cell[] =>
  Array.from({ length: level.cols * level.rows }, () => ({
    mine: false,
    near: 0,
    open: false,
    flag: false,
  }));

const neighbours = (index: number, level: Level): number[] => {
  const x = index % level.cols;
  const y = Math.floor(index / level.cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level.cols || ny >= level.rows) continue;
      out.push(ny * level.cols + nx);
    }
  }
  return out;
};

/* Mines are laid after the first click, not at the start.
 *
 * This is the rule that makes the game playable rather than a coin flip: the
 * first cell you open is guaranteed safe, and so are its neighbours, so every
 * game begins by opening a region rather than by dying or by clicking one
 * square at a time until something happens.
 */
function layMines(board: Cell[], level: Level, safeIndex: number): Cell[] {
  const next = board.map((cell) => ({ ...cell }));
  const forbidden = new Set([safeIndex, ...neighbours(safeIndex, level)]);

  let placed = 0;
  while (placed < level.mines) {
    const index = Math.floor(Math.random() * next.length);
    if (next[index].mine || forbidden.has(index)) continue;
    next[index].mine = true;
    placed += 1;
  }

  for (let i = 0; i < next.length; i += 1) {
    next[i].near = neighbours(i, level).filter((n) => next[n].mine).length;
  }
  return next;
}

/* Opening an empty cell opens everything reachable from it, which is the whole
 * texture of the game. Done with an explicit stack rather than recursion: an
 * Expert board can cascade over four hundred cells and a recursive flood fill
 * is a stack overflow waiting for the one board that does.
 */
function openFrom(board: Cell[], level: Level, start: number): Cell[] {
  const next = board.map((cell) => ({ ...cell }));
  const stack = [start];

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const cell = next[index];
    if (cell.open || cell.flag) continue;
    cell.open = true;
    if (cell.near === 0 && !cell.mine) stack.push(...neighbours(index, level));
  }
  return next;
}

export function Minesweeper() {
  const [level, setLevel] = useState(LEVELS[0]);
  const [board, setBoard] = useState(() => makeBoard(LEVELS[0]));
  const [status, setStatus] = useState<Status>("ready");
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (status !== "playing") {
      clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => setSeconds((s) => Math.min(999, s + 1)), 1000);
    return () => clearInterval(timer.current);
  }, [status]);

  const reset = (next: Level = level) => {
    setLevel(next);
    setBoard(makeBoard(next));
    setStatus("ready");
    setSeconds(0);
  };

  const flags = board.filter((c) => c.flag).length;

  const finish = (final: Cell[], won: boolean) => {
    setStatus(won ? "won" : "lost");
    /* Losing reveals every mine, which is how you find out where the one you
     * missed actually was. Winning flags the rest instead of opening them. */
    setBoard(
      final.map((cell) =>
        cell.mine ? { ...cell, open: !won, flag: won } : cell
      )
    );
  };

  const reveal = (index: number) => {
    if (status === "won" || status === "lost") return;
    if (board[index].flag || board[index].open) return;

    let current = board;
    if (status === "ready") {
      current = layMines(board, level, index);
      setStatus("playing");
    }

    if (current[index].mine) {
      finish(current, false);
      return;
    }

    const opened = openFrom(current, level, index);
    /* Won when every cell that is not a mine is open - the player never has to
     * flag anything, which is how the real game scores it too. */
    const remaining = opened.filter((c) => !c.mine && !c.open).length;
    if (remaining === 0) finish(opened, true);
    else setBoard(opened);
  };

  const toggleFlag = (e: ReactMouseEvent, index: number) => {
    e.preventDefault();
    if (status === "won" || status === "lost" || board[index].open) return;
    setBoard((prev) =>
      prev.map((cell, i) => (i === index ? { ...cell, flag: !cell.flag } : cell))
    );
  };

  const face = status === "lost" ? "😵" : status === "won" ? "😎" : "🙂";
  const digits = (n: number) => Math.max(-99, Math.min(999, n)).toString().padStart(3, "0");

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "Game",
            items: [
              { label: "New", onClick: () => reset() },
              ...LEVELS.map((l) => ({
                label: level.name === l.name ? `• ${l.name}` : `   ${l.name}`,
                onClick: () => reset(l),
              })),
            ],
          },
        ]}
      />

      <div className={styles.frame}>
        <div className={styles.head}>
          <span className={styles.counter}>{digits(level.mines - flags)}</span>
          <button type="button" className={styles.face} onClick={() => reset()} title="New game">
            {face}
          </button>
          <span className={styles.counter}>{digits(seconds)}</span>
        </div>

        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${level.cols}, 16px)` }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {board.map((cell, index) => {
            const classes = [styles.cell];
            if (cell.open) classes.push(styles.open);
            if (cell.open && cell.mine) classes.push(styles.mine);
            if (cell.open && !cell.mine && cell.near > 0) {
              classes.push(styles[`n${cell.near}`]);
            }
            return (
              <button
                key={index}
                type="button"
                className={classes.join(" ")}
                onClick={() => reveal(index)}
                onContextMenu={(e) => toggleFlag(e, index)}
              >
                {cell.open
                  ? cell.mine
                    ? "✸"
                    : cell.near > 0
                      ? cell.near
                      : ""
                  : cell.flag
                    ? "⚑"
                    : ""}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
