import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
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

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

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

/* The cards are 71 by 96, XP's size; a run fans down by twenty pixels. */
const FAN = 20;

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

  const won = useMemo(
    () => table.foundations.every((pile) => pile.length === 13),
    [table.foundations]
  );

  const newGame = () => {
    setTable(deal());
    setSelected(null);
    setMoves(0);
    setFlipping(new Set());
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

  const drawStock = () => {
    setSelected(null);
    setTable((t) => {
      if (t.stock.length === 0) {
        /* Turning the waste back over is unlimited here, as it is in Windows
         * Solitaire with draw-one. */
        return { ...t, stock: [...t.waste].reverse().map((c) => ({ ...c, faceUp: false })), waste: [] };
      }
      const card = { ...t.stock[t.stock.length - 1], faceUp: true };
      flip(card.id);
      return { ...t, stock: t.stock.slice(0, -1), waste: [...t.waste, card] };
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

  const renderCard = (card: Card, source: Source | null, offset: number, key: string) => {
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
        onGrab={grab}
        onMove={move}
        onRelease={release}
        onCancel={cancel}
        onHome={sendHome}
      />
    );
  };

  /* A click that reached the pile itself, not a card in it. Card presses are
   * handled on release and must not also count here, or a stale selection
   * would be moved a second time. */
  const bare = (e: ReactMouseEvent) => !(e.target as HTMLElement).closest("[data-card]");

  return (
    <div className={styles.app}>
      <MenuBar menus={[{ label: "Game", items: [{ label: "Deal", onClick: newGame }] }]} />

      <div className={styles.table}>
        <div className={styles.top}>
          {/* Stock */}
          <div className={styles.pile} onClick={drawStock}>
            {table.stock.length === 0 ? (
              <div className={styles.slot} />
            ) : (
              <div className={`${styles.card} ${styles.down}`} style={{ top: 0 }}>
                <div className={styles.face} />
                <div className={styles.back} />
              </div>
            )}
          </div>

          {/* Waste */}
          <div className={styles.pile}>
            {table.waste.length === 0 ? (
              <div className={styles.slot} />
            ) : (
              renderCard(table.waste[table.waste.length - 1], { from: "waste" }, 0, "waste")
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
                <div className={styles.slot}>
                  <span className={styles.slotSuit}>{SUITS[slot]}</span>
                </div>
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
                <CardFaces card={card} />
              </div>
            ))}
          </div>,
          document.body
        )}

      <div className={styles.status}>
        <span>
          {moves} move{moves === 1 ? "" : "s"}
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
  onGrab: (e: ReactPointerEvent<HTMLDivElement>, source: Source, card: Card) => void;
  onMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onRelease: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onCancel: () => void;
  onHome: (source: Source) => void;
};

function CardView({ card, source, className, offset, onGrab, onMove, onRelease, onCancel, onHome }: CardViewProps) {
  return (
    <div
      data-card
      className={className}
      style={{ top: offset }}
      onPointerDown={source ? (e) => onGrab(e, source, card) : undefined}
      onPointerMove={onMove}
      onPointerUp={onRelease}
      onPointerCancel={onCancel}
      onDoubleClick={() => source && card.faceUp && onHome(source)}
    >
      <CardFaces card={card} />
    </div>
  );
}

function CardFaces({ card }: { card: Card }) {
  return (
    <>
      <div className={`${styles.face} ${isRed(card.suit) ? styles.red : styles.black}`}>
        <span className={styles.corner}>
          <span>{RANKS[card.rank - 1]}</span>
          <span>{card.suit}</span>
        </span>
        <span className={styles.pip}>{card.suit}</span>
      </div>
      <div className={styles.back} />
    </>
  );
}
