import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { MenuBar } from "../components/MenuBar";
import styles from "./Solitaire.module.css";

/* Klondike, one card at a time from the stock.
 *
 * Cards are dragged, as they were, and a run comes along with the card at the
 * top of it. A click also works: click a card, then where it goes - which is
 * what every touch port of this does, and what a mouse user does when the
 * card is one pixel from the pile anyway. Double-click sends a card home.
 */

const SUITS = ["♠", "♥", "♦", "♣"] as const;
type Suit = (typeof SUITS)[number];

/* The cards are the bitmaps out of cards.dll, 71 by 96, on one sheet:
 * four rows of thirteen faces in the DLL's order - clubs, diamonds, hearts,
 * spades - and a fifth row of the twelve backs and the "O" that marks an
 * empty stock. Drawn at one pixel per pixel; they were never meant to
 * scale, and pixelated is what they looked like. */
const SHEET_ROW: Record<Suit, number> = { "♣": 0, "♦": 1, "♥": 2, "♠": 3 };
const BACKS = 12;
const BACK_KEY = "funos.sol.back";
const loadBack = (): number => {
  try {
    const n = Number(localStorage.getItem(BACK_KEY));
    return Number.isInteger(n) && n >= 0 && n < BACKS ? n : 0;
  } catch {
    return 0;
  }
};
const at = (col: number, row: number) => ({ backgroundPosition: `${-col * 71}px ${-row * 96}px` });
const faceAt = (card: Card) => at(card.rank - 1, SHEET_ROW[card.suit]);
const backAt = (back: number) => at(back, 4);
const MARKER = at(BACKS, 4);
/* The X: the stock is spent and the rules allow no more passes. */
const SPENT = at(BACKS + 1, 4);

/* Game > Options, as XP had them. Draw three turns three cards at a time
 * and fans them; Standard scoring is the one everyone saw; Vegas starts you
 * fifty-two dollars down and pays five a card, with the passes through the
 * deck limited to one (draw one) or three (draw three). */
type Options = {
  draw: 1 | 3;
  scoring: "standard" | "vegas" | "none";
  timed: boolean;
  /** Vegas: the dollars carry over from deal to deal. */
  keepScore: boolean;
};
const OPTIONS_KEY = "funos.sol.options";
const DEFAULT_OPTIONS: Options = { draw: 1, scoring: "standard", timed: true, keepScore: false };
const loadOptions = (): Options => {
  try {
    const p = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "{}") as Partial<Options>;
    return {
      draw: p.draw === 3 ? 3 : 1,
      scoring: p.scoring === "vegas" || p.scoring === "none" ? p.scoring : "standard",
      timed: p.timed !== false,
      keepScore: p.keepScore === true,
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
};
const saveOptions = (o: Options) => {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(o));
  } catch {
    /* Private mode. */
  }
};

type Card = {
  id: string;
  suit: Suit;
  /** 1 for Ace through 13 for King - compared far more often than the label. */
  rank: number;
  faceUp: boolean;
};

const isRed = (suit: Suit) => suit === "♥" || suit === "♦";

type Table = {
  stock: Card[];
  waste: Card[];
  /** One per suit, in SUITS order. */
  foundations: Card[][];
  tableau: Card[][];
};

function deal(): Table {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ id: `${suit}${rank}`, suit, rank, faceUp: false });
    }
  }
  /* Fisher-Yates. The naive `sort(() => Math.random() - 0.5)` is not a shuffle -
   * it is biased badly enough that some deals come up far more often than
   * others, which in a game with a win rate people already argue about is not
   * a detail to get wrong. */
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const tableau: Card[][] = [];
  let cursor = 0;
  for (let column = 0; column < 7; column += 1) {
    const pile = deck.slice(cursor, cursor + column + 1);
    cursor += column + 1;
    pile[pile.length - 1].faceUp = true;
    tableau.push(pile);
  }

  return { stock: deck.slice(cursor), waste: [], foundations: [[], [], [], []], tableau };
}

type Source =
  | { from: "waste" }
  | { from: "tableau"; column: number; index: number }
  | { from: "foundation"; slot: number };

type Destination = { to: "tableau"; column: number } | { to: "foundation"; slot: number };

const canStack = (card: Card, onto: Card | undefined): boolean => {
  /* An empty column takes a King and nothing else, which is the rule that
   * makes the endgame a puzzle rather than a shuffle. */
  if (!onto) return card.rank === 13;
  return isRed(card.suit) !== isRed(onto.suit) && card.rank === onto.rank - 1;
};

const canFound = (card: Card, pile: Card[], slot: number): boolean => {
  if (card.suit !== SUITS[slot]) return false;
  return pile.length === 0 ? card.rank === 1 : card.rank === pile[pile.length - 1].rank + 1;
};

/** The pile a card sits in, as somewhere another card could be dropped. */
const destinationOf = (source: Source): Destination | null => {
  if (source.from === "tableau") return { to: "tableau", column: source.column };
  if (source.from === "foundation") return { to: "foundation", slot: source.slot };
  return null;
};

/** The pile under a point, read off the `data-drop` the piles carry. */
const dropAt = (x: number, y: number): Destination | null => {
  const key = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]")?.dataset.drop;
  if (!key) return null;
  const n = Number(key.slice(1));
  return key[0] === "f" ? { to: "foundation", slot: n } : { to: "tableau", column: n };
};

/* The cards are 71 by 96, XP's size; a run fans down by twenty pixels, and
 * a draw of three fans right by twelve. */
const FAN = 20;
const WASTE_FAN = 12;

type Drag = {
  source: Source;
  cards: Card[];
  /** Where in the card the pointer took hold, so it does not jump. */
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  /** Past the few pixels that tell a drag from a click. */
  moved: boolean;
};

export function Solitaire() {
  const [table, setTable] = useState<Table>(deal);
  const [selected, setSelected] = useState<Source | null>(null);
  const [moves, setMoves] = useState(0);
  /* Cards that have just been turned over, so the flip animation plays once
   * and is not replayed on every unrelated re-render. */
  const [flipping, setFlipping] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [back, setBack] = useState(loadBack);
  const [choosingBack, setChoosingBack] = useState(false);
  const [options, setOptions] = useState<Options>(loadOptions);
  /* The dialog edits a copy; OK applies it. */
  const [draft, setDraft] = useState<Options | null>(null);
  const [score, setScore] = useState(() => (loadOptions().scoring === "vegas" ? -52 : 0));
  const [seconds, setSeconds] = useState(0);
  /* Passes made through the stock, for Vegas' limit. */
  const [passes, setPasses] = useState(0);
  /* How many of the waste's top cards are fanned out: the last draw's,
   * fewer as they are played. */
  const [fanned, setFanned] = useState(1);
  const started = moves > 0 || table.waste.length > 0;
  const chooseBack = (n: number) => {
    setBack(n);
    setChoosingBack(false);
    try {
      localStorage.setItem(BACK_KEY, String(n));
    } catch {
      /* Private mode. */
    }
  };

  const won = useMemo(
    () => table.foundations.every((pile) => pile.length === 13),
    [table.foundations]
  );

  const newGame = (next: Options = options) => {
    setTable(deal());
    setSelected(null);
    setMoves(0);
    setFlipping(new Set());
    setSeconds(0);
    setPasses(0);
    setFanned(1);
    /* Vegas: the ante again, on top of whatever was kept. Anything else
     * starts from nothing. */
    setScore((s) => (next.scoring === "vegas" ? (next.keepScore ? s : 0) - 52 : 0));
  };

  /* The clock: from the first move to the win, a second at a time, and in
   * Standard scoring two points off every ten seconds - which is what made
   * people play fast. */
  useEffect(() => {
    if (!options.timed || !started || won) return;
    const t = window.setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (options.scoring === "standard" && next % 10 === 0) setScore((sc) => sc - 2);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [options.timed, options.scoring, started, won]);

  /** Points for a move, by the scoring in force. */
  const credit = (source: Source, destination: Destination, turnedOver: boolean) => {
    if (options.scoring === "none") return;
    let delta = 0;
    if (options.scoring === "vegas") {
      if (destination.to === "foundation") delta += 5;
      if (source.from === "foundation") delta -= 5;
    } else {
      if (destination.to === "foundation") delta += 10;
      else if (source.from === "waste") delta += 5;
      if (source.from === "foundation") delta -= 15;
      if (turnedOver) delta += 5;
    }
    /* The last card home wins, and a timed Standard win pays a bonus:
     * 700,000 over the seconds it took, for anything over half a minute. */
    if (
      destination.to === "foundation" &&
      options.scoring === "standard" &&
      options.timed &&
      seconds > 30 &&
      table.foundations.reduce((n, pile) => n + pile.length, 0) + 1 === 52
    ) {
      delta += Math.floor(700000 / seconds);
    }
    if (delta) setScore((s) => s + delta);
  };

  const applyOptions = () => {
    if (!draft) return;
    const changed = draft.draw !== options.draw || draft.scoring !== options.scoring;
    setOptions(draft);
    saveOptions(draft);
    setDraft(null);
    /* The deck and the scoring are the game; changing them is a new one. */
    if (changed) newGame(draft);
  };

  const flip = (id: string) => {
    setFlipping((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setFlipping((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  };

  /** The cards a selection picks up: one from the waste, a run from a column. */
  const takeFrom = (source: Source): Card[] => {
    if (source.from === "waste") {
      const card = table.waste[table.waste.length - 1];
      return card ? [card] : [];
    }
    if (source.from === "foundation") {
      const card = table.foundations[source.slot].at(-1);
      return card ? [card] : [];
    }
    return table.tableau[source.column].slice(source.index);
  };

  /* Vegas allows one pass with draw one and three with draw three; the
   * others turn the waste over as often as you like, and Standard with draw
   * one charges a hundred points for it. */
  const stockSpent = table.stock.length === 0 && options.scoring === "vegas" && passes + 1 >= options.draw;

  const drawStock = () => {
    setSelected(null);
    if (table.stock.length === 0) {
      if (stockSpent || table.waste.length === 0) return;
      setPasses((p) => p + 1);
      if (options.scoring === "standard" && options.draw === 1) setScore((s) => s - 100);
      setFanned(1);
      setTable((t) => ({ ...t, stock: [...t.waste].reverse().map((c) => ({ ...c, faceUp: false })), waste: [] }));
      return;
    }
    const n = Math.min(options.draw, table.stock.length);
    setFanned(n);
    setTable((t) => {
      const drawn = t.stock.slice(-n).reverse().map((c) => ({ ...c, faceUp: true }));
      drawn.forEach((c) => flip(c.id));
      return { ...t, stock: t.stock.slice(0, -n), waste: [...t.waste, ...drawn] };
    });
  };

  /* Removing the moved cards and turning over whatever they were covering.
   * Kept separate from the placing half because every destination needs it and
   * forgetting the turn-over is the classic Klondike bug. */
  const removeFrom = (t: Table, source: Source): Table => {
    if (source.from === "waste") return { ...t, waste: t.waste.slice(0, -1) };
    if (source.from === "foundation") {
      return {
        ...t,
        foundations: t.foundations.map((pile, i) =>
          i === source.slot ? pile.slice(0, -1) : pile
        ),
      };
    }
    return {
      ...t,
      tableau: t.tableau.map((pile, i) => {
        if (i !== source.column) return pile;
        const rest = pile.slice(0, source.index);
        const last = rest[rest.length - 1];
        if (last && !last.faceUp) {
          flip(last.id);
          return [...rest.slice(0, -1), { ...last, faceUp: true }];
        }
        return rest;
      }),
    };
  };

  /** Whether the cards from `source` may go to `destination`, by the rules. */
  const fits = (cards: Card[], destination: Destination): boolean => {
    if (cards.length === 0) return false;
    if (destination.to === "foundation") {
      /* Only ever one card to a foundation, so a run cannot be sent there even
       * if its bottom card would fit. */
      return cards.length === 1 && canFound(cards[0], table.foundations[destination.slot], destination.slot);
    }
    const target = table.tableau[destination.column];
    return canStack(cards[0], target[target.length - 1]);
  };

  /* The source is a parameter, not a read of the selection: sendHome and a
   * drop both move a card they have only just chosen, before any state has
   * caught up. Returns whether the move was made, so a click on a card that
   * will not take the selection can select that card instead.
   */
  const moveTo = (destination: Destination, source: Source): boolean => {
    const cards = takeFrom(source);
    const same = destinationOf(source);
    if (same && same.to === destination.to && (same.to === "tableau" ? same.column : same.slot) === (destination.to === "tableau" ? destination.column : destination.slot)) {
      return false;
    }
    if (!fits(cards, destination)) return false;

    if (source.from === "waste") setFanned((f) => Math.max(1, f - 1));
    const under = source.from === "tableau" ? table.tableau[source.column][source.index - 1] : undefined;
    credit(source, destination, under !== undefined && !under.faceUp);
    setTable((t) => {
      const stripped = removeFrom(t, source);
      if (destination.to === "foundation") {
        return {
          ...stripped,
          foundations: stripped.foundations.map((pile, i) =>
            i === destination.slot ? [...pile, cards[0]] : pile
          ),
        };
      }
      return {
        ...stripped,
        tableau: stripped.tableau.map((pile, i) =>
          i === destination.column ? [...pile, ...cards] : pile
        ),
      };
    });
    setMoves((m) => m + 1);
    setSelected(null);
    return true;
  };

  /** Double-click shortcut: send a single card to whichever foundation takes it. */
  const sendHome = (source: Source) => {
    const cards = takeFrom(source);
    if (cards.length !== 1) return;
    const slot = table.foundations.findIndex((pile, i) => canFound(cards[0], pile, i));
    if (slot === -1) return;
    moveTo({ to: "foundation", slot }, source);
  };

  const sameSource = (a: Source | null, b: Source): boolean => {
    if (!a) return false;
    if (a.from !== b.from) return false;
    if (a.from === "tableau" && b.from === "tableau") {
      return a.column === b.column && a.index === b.index;
    }
    if (a.from === "foundation" && b.from === "foundation") return a.slot === b.slot;
    return true;
  };

  /* A click on a card: select it; click the same card to let go; click
   * another card to put the selection on its pile - or, when the rules say
   * no, to pick up that card instead, which is what people mean. */
  const tap = (source: Source) => {
    if (!selected) {
      setSelected(source);
      return;
    }
    if (sameSource(selected, source)) {
      setSelected(null);
      return;
    }
    const destination = destinationOf(source);
    if (destination && moveTo(destination, selected)) return;
    setSelected(source);
  };

  /** A click on the bare pile: the empty column, the foundation's outline. */
  const tapPile = (destination: Destination) => {
    if (!selected) return;
    if (!moveTo(destination, selected)) setSelected(null);
  };

  /* The drag. Pointer events, captured by the card that was pressed, so the
   * run follows the pointer out of the window and back; the drop is a hit
   * test on the piles beneath the floating cards, which cannot be hit
   * themselves. Under a few pixels of travel the press is a click. */
  const grab = (e: ReactPointerEvent<HTMLDivElement>, source: Source, card: Card) => {
    if (e.button !== 0 || !card.faceUp) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const next: Drag = {
      source,
      cards: takeFrom(source),
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      x: rect.left,
      y: rect.top,
      moved: false,
    };
    dragRef.current = next;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const x = e.clientX - d.grabX;
    const y = e.clientY - d.grabY;
    const moved = d.moved || Math.abs(x - d.x) > 4 || Math.abs(y - d.y) > 4;
    if (!moved) return;
    dragRef.current = { ...d, x, y, moved: true };
    setDrag(dragRef.current);
  };

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) {
      tap(d.source);
      return;
    }
    setDrag(null);
    setSelected(null);
    const destination = dropAt(e.clientX, e.clientY);
    if (destination) moveTo(destination, d.source);
  };

  const lifted = (card: Card) => drag?.cards.some((c) => c.id === card.id) ?? false;

  const cancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const renderCard = (card: Card, source: Source | null, offset: number, key: string, fanX = 0) => {
    const classes = [styles.card];
    if (!card.faceUp) classes.push(styles.down);
    if (flipping.has(card.id)) classes.push(styles.flip);
    if (source && sameSource(selected, source)) classes.push(styles.selected);
    if (lifted(card)) classes.push(styles.lifted);

    return (
      <CardView
        key={key}
        card={card}
        source={source}
        className={classes.join(" ")}
        offset={offset}
        fanX={fanX}
        onGrab={grab}
        onMove={move}
        onRelease={release}
        onCancel={cancel}
        onHome={sendHome}
        back={back}
      />
    );
  };

  /* A click that reached the pile itself, not a card in it. Card presses are
   * handled on release and must not also count here, or a stale selection
   * would be moved a second time. */
  const bare = (e: ReactMouseEvent) => !(e.target as HTMLElement).closest("[data-card]");

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "Game",
            items: [
              { label: "Deal", onClick: () => newGame() },
              { label: "Deck...", onClick: () => setChoosingBack(true) },
              { label: "Options...", onClick: () => setDraft(options) },
            ],
          },
        ]}
      />

      {/* Select Card Back: the twelve, in a box over the table. */}
      {choosingBack && (
        <div className={styles.deckDialog} role="dialog" aria-label="Select Card Back">
          <div className={styles.deckTitle}>Select Card Back</div>
          <div className={styles.deckGrid}>
            {Array.from({ length: BACKS }, (_, n) => (
              <button
                key={n}
                type="button"
                className={n === back ? `${styles.deckChoice} ${styles.deckChosen}` : styles.deckChoice}
                onClick={() => chooseBack(n)}
                aria-label={`Card back ${n + 1}`}
              >
                <span className={styles.sheet} style={backAt(n)} />
              </button>
            ))}
          </div>
          <div className={styles.deckButtons}>
            <button type="button" onClick={() => setChoosingBack(false)}>
              OK
            </button>
            <button type="button" onClick={() => setChoosingBack(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Options: draw, scoring, the clock; the same box as the deck's. */}
      {draft && (
        <div className={styles.deckDialog} role="dialog" aria-label="Options">
          <div className={styles.deckTitle}>Options</div>
          <div className={styles.optionsRow}>
            <fieldset className={styles.optionsGroup}>
              <legend>Draw</legend>
              <div className={styles.field}>
                <input type="radio" id="sol-draw1" name="sol-draw" checked={draft.draw === 1} onChange={() => setDraft({ ...draft, draw: 1 })} />
                <label htmlFor="sol-draw1">Draw one</label>
              </div>
              <div className={styles.field}>
                <input type="radio" id="sol-draw3" name="sol-draw" checked={draft.draw === 3} onChange={() => setDraft({ ...draft, draw: 3 })} />
                <label htmlFor="sol-draw3">Draw three</label>
              </div>
            </fieldset>
            <fieldset className={styles.optionsGroup}>
              <legend>Scoring</legend>
              {(["standard", "vegas", "none"] as const).map((mode) => (
                <div className={styles.field} key={mode}>
                  <input type="radio" id={`sol-score-${mode}`} name="sol-score" checked={draft.scoring === mode} onChange={() => setDraft({ ...draft, scoring: mode })} />
                  <label htmlFor={`sol-score-${mode}`}>{mode === "standard" ? "Standard" : mode === "vegas" ? "Vegas" : "None"}</label>
                </div>
              ))}
            </fieldset>
          </div>
          <div className={styles.optionsChecks}>
            <div className={styles.field}>
              <input type="checkbox" id="sol-timed" checked={draft.timed} onChange={(e) => setDraft({ ...draft, timed: e.target.checked })} />
              <label htmlFor="sol-timed">Timed game</label>
            </div>
            <div className={styles.field}>
              <input type="checkbox" id="sol-keep" checked={draft.keepScore} disabled={draft.scoring !== "vegas"} onChange={(e) => setDraft({ ...draft, keepScore: e.target.checked })} />
              <label htmlFor="sol-keep">Keep score</label>
            </div>
          </div>
          <div className={styles.deckButtons}>
            <button type="button" onClick={applyOptions}>
              OK
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={styles.table}>
        <div className={styles.top}>
          {/* Stock */}
          <div className={styles.pile} onClick={drawStock}>
            {table.stock.length === 0 ? (
              <div className={`${styles.slot} ${styles.sheet}`} style={stockSpent ? SPENT : MARKER} />
            ) : (
              <div className={`${styles.card} ${styles.down}`} style={{ top: 0 }}>
                <div className={`${styles.face} ${styles.sheet}`} style={backAt(back)} />
                <div className={`${styles.back} ${styles.sheet}`} style={backAt(back)} />
              </div>
            )}
          </div>

          {/* Waste: the last draw fanned to the right, the top one playable. */}
          <div className={options.draw === 3 ? `${styles.pile} ${styles.wasteWide}` : styles.pile}>
            {table.waste.length === 0 ? (
              <div className={styles.slot} />
            ) : (
              table.waste
                .slice(-Math.min(fanned, table.waste.length))
                .map((card, i, fan) =>
                  renderCard(card, i === fan.length - 1 ? { from: "waste" } : null, 0, card.id, i * WASTE_FAN)
                )
            )}
          </div>

          <div className={styles.spacer} />

          {table.foundations.map((pile, slot) => (
            <div
              key={SUITS[slot]}
              className={styles.pile}
              data-drop={`f${slot}`}
              onClick={(e) => bare(e) && tapPile({ to: "foundation", slot })}
            >
              {pile.length === 0 ? (
                <div className={styles.slot} />
              ) : (
                renderCard(pile[pile.length - 1], { from: "foundation", slot }, 0, `f${slot}`)
              )}
            </div>
          ))}
        </div>

        <div className={styles.columns}>
          {table.tableau.map((pile, column) => (
            <div
              key={column}
              className={styles.pile}
              data-drop={`t${column}`}
              style={{ minHeight: 96 + Math.max(0, pile.length - 1) * FAN }}
              onClick={(e) => bare(e) && tapPile({ to: "tableau", column })}
            >
              {pile.length === 0 && <div className={styles.slot} />}
              {pile.map((card, index) =>
                renderCard(
                  card,
                  card.faceUp ? { from: "tableau", column, index } : null,
                  /* Face-down cards overlap more tightly, so a long column does
                   * not run off the bottom before the playable cards start. */
                  pile.slice(0, index).reduce((y, c) => y + (c.faceUp ? FAN : 12), 0),
                  card.id
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* The run in flight, over everything and under the pointer. */}
      {drag &&
        createPortal(
          <div className={styles.flight} style={{ left: drag.x, top: drag.y }}>
            {drag.cards.map((card, i) => (
              <div key={card.id} className={styles.card} style={{ top: i * FAN }}>
                <CardFaces card={card} back={back} />
              </div>
            ))}
          </div>,
          document.body
        )}

      <div className={styles.status}>
        <span>
          {options.scoring !== "none" && (
            <span className={styles.statusField}>Score: {options.scoring === "vegas" ? `$${score}` : score}</span>
          )}
          {options.timed && <span className={styles.statusField}>Time: {seconds}</span>}
          {won && <span className={styles.win}>You win.</span>}
        </span>
        <span>Drag a card where it goes, or click it and then the pile. Double-click sends it home.</span>
      </div>
    </div>
  );
}

type CardViewProps = {
  card: Card;
  source: Source | null;
  className: string;
  offset: number;
  fanX?: number;
  onGrab: (e: ReactPointerEvent<HTMLDivElement>, source: Source, card: Card) => void;
  onMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onRelease: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onCancel: () => void;
  onHome: (source: Source) => void;
  back: number;
};

function CardView({ card, source, className, offset, fanX = 0, onGrab, onMove, onRelease, onCancel, onHome, back }: CardViewProps) {
  return (
    <div
      data-card
      className={className}
      style={{ top: offset, left: fanX }}
      onPointerDown={source ? (e) => onGrab(e, source, card) : undefined}
      onPointerMove={onMove}
      onPointerUp={onRelease}
      onPointerCancel={onCancel}
      onDoubleClick={() => source && card.faceUp && onHome(source)}
    >
      <CardFaces card={card} back={back} />
    </div>
  );
}

function CardFaces({ card, back }: { card: Card; back: number }) {
  return (
    <>
      <div className={`${styles.face} ${styles.sheet}`} style={faceAt(card)} />
      <div className={`${styles.back} ${styles.sheet}`} style={backAt(back)} />
    </>
  );
}
