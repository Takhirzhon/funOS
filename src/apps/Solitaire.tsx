import { useMemo, useState } from "react";
import { MenuBar } from "../components/MenuBar";
import styles from "./Solitaire.module.css";

/* Klondike, one card at a time from the stock.
 *
 * Moves are made by clicking a source and then a destination, not by dragging.
 * Dragging a stack of cards means hit-testing a pile that overlaps six others
 * while the pointer is down; click-to-move is the same game with a tenth of
 * the machinery, and it is what every touch port of this does anyway.
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

export function Solitaire() {
  const [table, setTable] = useState<Table>(deal);
  const [selected, setSelected] = useState<Source | null>(null);
  const [moves, setMoves] = useState(0);
  /* Cards that have just been turned over, so the flip animation plays once
   * and is not replayed on every unrelated re-render. */
  const [flipping, setFlipping] = useState<Set<string>>(new Set());

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

  /* The source is a parameter with the selection as its default, not a read of
   * the selection itself. sendHome needs to move a card it has only just
   * chosen, and a state setter does not take effect until the next render - so
   * a version that read `selected` would move whatever was selected *before*
   * the double-click, which is a wrong card rather than no card.
   */
  const moveTo = (
    destination: { to: "tableau"; column: number } | { to: "foundation"; slot: number },
    source: Source | null = selected
  ) => {
    if (!source) return;
    const cards = takeFrom(source);
    if (cards.length === 0) {
      setSelected(null);
      return;
    }

    if (destination.to === "foundation") {
      /* Only ever one card to a foundation, so a run cannot be sent there even
       * if its bottom card would fit. */
      if (cards.length !== 1 || !canFound(cards[0], table.foundations[destination.slot], destination.slot)) {
        setSelected(null);
        return;
      }
      setTable((t) => {
        const stripped = removeFrom(t, source);
        return {
          ...stripped,
          foundations: stripped.foundations.map((pile, i) =>
            i === destination.slot ? [...pile, cards[0]] : pile
          ),
        };
      });
    } else {
      const target = table.tableau[destination.column];
      if (!canStack(cards[0], target[target.length - 1])) {
        setSelected(null);
        return;
      }
      setTable((t) => {
        const stripped = removeFrom(t, source);
        return {
          ...stripped,
          tableau: stripped.tableau.map((pile, i) =>
            i === destination.column ? [...pile, ...cards] : pile
          ),
        };
      });
    }

    setMoves((m) => m + 1);
    setSelected(null);
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

  const renderCard = (card: Card, source: Source | null, offset: number, key: string) => {
    const classes = [styles.card];
    if (!card.faceUp) classes.push(styles.down);
    if (flipping.has(card.id)) classes.push(styles.flip);
    if (source && sameSource(selected, source)) classes.push(styles.selected);

    return (
      <div
        key={key}
        className={classes.join(" ")}
        style={{ top: offset }}
        onClick={() => {
          if (!source || !card.faceUp) return;
          setSelected((prev) => (sameSource(prev, source) ? null : source));
        }}
        onDoubleClick={() => source && card.faceUp && sendHome(source)}
      >
        <div className={`${styles.face} ${isRed(card.suit) ? styles.red : styles.black}`}>
          <span className={styles.corner}>
            <span>{RANKS[card.rank - 1]}</span>
            <span>{card.suit}</span>
          </span>
          <span className={styles.pip}>{card.suit}</span>
        </div>
        <div className={styles.back} />
      </div>
    );
  };

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
              onClick={() => (selected ? moveTo({ to: "foundation", slot }) : undefined)}
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
              style={{ minHeight: 96 + Math.max(0, pile.length - 1) * 20 }}
              onClick={(e) => {
                /* Only the empty area of a column gets here; a click on a card
                 * is handled by the card and stops there. */
                if (e.target === e.currentTarget && selected) moveTo({ to: "tableau", column });
              }}
            >
              {pile.length === 0 && (
                <div
                  className={styles.slot}
                  onClick={() => selected && moveTo({ to: "tableau", column })}
                />
              )}
              {pile.map((card, index) =>
                renderCard(
                  card,
                  card.faceUp ? { from: "tableau", column, index } : null,
                  /* Face-down cards overlap more tightly, so a long column does
                   * not run off the bottom before the playable cards start. */
                  pile.slice(0, index).reduce((y, c) => y + (c.faceUp ? 20 : 12), 0),
                  card.id
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.status}>
        <span>
          {moves} move{moves === 1 ? "" : "s"}
          {won && <span className={styles.win}>You win.</span>}
        </span>
        <span>Click a card, then where it goes. Double-click sends it home.</span>
      </div>
    </div>
  );
}
