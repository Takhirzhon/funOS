import { useEffect, useRef, useState } from "react";
import { MenuBar } from "../components/MenuBar";
import styles from "./Calculator.module.css";

type Op = "+" | "-" | "*" | "/" | "^" | null;

/* Calculator shows fifteen significant digits and drops trailing zeros, which
 * is what keeps 0.1 + 0.2 reading as 0.3 rather than as the sum of two floats.
 * Beyond that it switches to exponent notation instead of widening the window.
 */
function format(value: number): string {
  if (!Number.isFinite(value)) return "Cannot divide by zero.";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-14) return value.toExponential(10).replace(/e([+-])/, "e$1");
  return String(Number(value.toPrecision(15)));
}

export function Calculator() {
  const [scientific, setScientific] = useState(false);
  /* `entry` is the string being typed; `accumulator` is the running total.
   * Keeping the typed value as text rather than a number is what lets "1.50"
   * stay "1.50" while it is being typed instead of collapsing to 1.5. */
  const [entry, setEntry] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pending, setPending] = useState<Op>(null);
  const [memory, setMemory] = useState(0);
  /* True once an operator has been pressed: the next digit replaces the
   * display rather than appending to it. */
  const [fresh, setFresh] = useState(true);
  const [error, setError] = useState(false);

  const appRef = useRef<HTMLDivElement>(null);

  const value = Number(entry);

  const reset = () => {
    setEntry("0");
    setAccumulator(null);
    setPending(null);
    setFresh(true);
    setError(false);
  };

  const show = (n: number) => {
    if (!Number.isFinite(n)) {
      setEntry("Cannot divide by zero.");
      setError(true);
      return;
    }
    setEntry(format(n));
  };

  const digit = (d: string) => {
    if (error) reset();
    setError(false);
    setEntry((prev) => {
      if (fresh) return d === "." ? "0." : d;
      if (d === "." && prev.includes(".")) return prev;
      if (prev === "0" && d !== ".") return d;
      return prev + d;
    });
    setFresh(false);
  };

  const apply = (a: number, op: Op, b: number): number => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? Number.POSITIVE_INFINITY : a / b;
      case "^": return a ** b;
      default: return b;
    }
  };

  const operator = (op: Op) => {
    if (error) return;
    /* Pressing two operators in a row replaces the pending one rather than
     * computing with a repeated operand - "5 + *" means "5 *". */
    if (pending !== null && !fresh && accumulator !== null) {
      const result = apply(accumulator, pending, value);
      setAccumulator(result);
      show(result);
    } else {
      setAccumulator(value);
    }
    setPending(op);
    setFresh(true);
  };

  const equals = () => {
    if (error || pending === null || accumulator === null) return;
    const result = apply(accumulator, pending, value);
    show(result);
    setAccumulator(null);
    setPending(null);
    setFresh(true);
  };

  const unary = (fn: (n: number) => number) => {
    if (error) return;
    const result = fn(value);
    show(result);
    setFresh(true);
  };

  const factorial = (n: number): number => {
    if (n < 0 || !Number.isInteger(n)) return Number.NaN;
    if (n > 170) return Number.POSITIVE_INFINITY;
    let out = 1;
    for (let i = 2; i <= n; i += 1) out *= i;
    return out;
  };

  /* The keyboard works, because a calculator that has to be clicked is a
   * calculator nobody uses twice. Scoped to this window: the listener only
   * runs while the focus is inside it, so typing in Notepad is unaffected.
   */
  useEffect(() => {
    const node = appRef.current;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (/^[0-9]$/.test(k)) digit(k);
      else if (k === "." || k === ",") digit(".");
      else if (k === "+" || k === "-" || k === "*" || k === "/") operator(k);
      else if (k === "Enter" || k === "=") equals();
      else if (k === "Escape") reset();
      else if (k === "Backspace") setEntry((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
      else return;
      e.preventDefault();
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  });

  const key = (label: string, onClick: () => void, tone?: string) => (
    <button
      key={label}
      type="button"
      className={tone ? `${styles.key} ${tone}` : styles.key}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const digits = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
  ];

  return (
    <div className={styles.app} ref={appRef} tabIndex={-1}>
      <MenuBar
        menus={[
          {
            label: "View",
            items: [
              { label: scientific ? "   Standard" : "• Standard", onClick: () => setScientific(false) },
              { label: scientific ? "• Scientific" : "   Scientific", onClick: () => setScientific(true) },
            ],
          },
        ]}
      />

      <div className={styles.display}>{entry}</div>

      <div className={styles.memory}>
        <span>{memory !== 0 ? "M" : ""}</span>
      </div>

      <div className={`${styles.pad} ${scientific ? styles.scientific : styles.standard}`}>
        {scientific && (
          <>
            {key("sin", () => unary(Math.sin))}
            {key("cos", () => unary(Math.cos))}
            {key("tan", () => unary(Math.tan))}
            {key("ln", () => unary(Math.log))}
            {key("log", () => unary(Math.log10))}
            {key("x²", () => unary((n) => n * n))}
            {/* No √ here: it is already on the standard pad below, and the
                helper keys these buttons by their label - two of them would
                collide. */}
            {key("n!", () => unary(factorial))}
            {key("π", () => { setEntry(format(Math.PI)); setFresh(true); })}
            {key("e", () => { setEntry(format(Math.E)); setFresh(true); })}
            {key("1/x", () => unary((n) => (n === 0 ? Number.POSITIVE_INFINITY : 1 / n)))}
            {key("x^y", () => operator("^"), styles.op)}
            {key("exp", () => unary(Math.exp))}
            {key("x³", () => unary((n) => n * n * n))}
            {key("10^x", () => unary((n) => 10 ** n))}
            {key("∛", () => unary(Math.cbrt))}
          </>
        )}

        {key("MC", () => setMemory(0), styles.mem)}
        {key("MR", () => { setEntry(format(memory)); setFresh(true); }, styles.mem)}
        {key("MS", () => setMemory(value), styles.mem)}
        {key("M+", () => setMemory((m) => m + value), styles.mem)}
        {key("C", reset, styles.clear)}

        {digits[0].map((d) => key(d, () => digit(d)))}
        {key("/", () => operator("/"), styles.op)}
        {key("←", () => setEntry((p) => (p.length <= 1 ? "0" : p.slice(0, -1))), styles.clear)}

        {digits[1].map((d) => key(d, () => digit(d)))}
        {key("*", () => operator("*"), styles.op)}
        {key("√", () => unary(Math.sqrt), styles.op)}

        {digits[2].map((d) => key(d, () => digit(d)))}
        {key("-", () => operator("-"), styles.op)}
        {key("%", () => unary((n) => n / 100), styles.op)}

        {key("0", () => digit("0"))}
        {key("±", () => unary((n) => -n))}
        {key(".", () => digit("."))}
        {key("+", () => operator("+"), styles.op)}
        {key("=", equals, styles.op)}
      </div>
    </div>
  );
}
