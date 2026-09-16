import styles from "./Rover.module.css";

/* Rover, or a dog in his spirit: the animated screen character that sat in
 * the corner of the Search Companion, wagged, blinked, and looked busy
 * while the search ran. Drawn as SVG and animated in CSS - the original's
 * frames are Microsoft's and not in the icon set, and a dog is a dog.
 *
 * Three moods: waiting (a slow wag, the occasional blink), searching (the
 * head down, ears up, a faster wag - sniffing), and found (a bounce). */
export function Rover({ mood, line }: { mood: "idle" | "searching" | "found"; line: string }) {
  return (
    <div className={`${styles.rover} ${styles[mood]}`} aria-hidden>
      <div className={styles.bubble}>{line}</div>
      <svg viewBox="0 0 120 110" className={styles.dog}>
        <defs>
          <linearGradient id="rv-fur" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f1c98a" />
            <stop offset="1" stopColor="#c99551" />
          </linearGradient>
          <linearGradient id="rv-ear" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#8a5a2b" />
            <stop offset="1" stopColor="#5e3a15" />
          </linearGradient>
        </defs>
        {/* tail */}
        <g className={styles.tail}>
          <path d="M92 70 q18 -14 12 -32" stroke="#8a5a2b" strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
        {/* body */}
        <ellipse cx="66" cy="80" rx="34" ry="24" fill="url(#rv-fur)" stroke="#6b4419" strokeWidth="1.5" />
        <ellipse cx="66" cy="90" rx="20" ry="11" fill="#fbe7c4" />
        {/* paws */}
        <ellipse cx="46" cy="101" rx="10" ry="5" fill="#e8b96f" stroke="#6b4419" strokeWidth="1.2" />
        <ellipse cx="84" cy="101" rx="10" ry="5" fill="#e8b96f" stroke="#6b4419" strokeWidth="1.2" />
        {/* head */}
        <g className={styles.head}>
          <path className={styles.earL} d="M26 30 q-14 8 -8 30 q10 4 16 -8 z" fill="url(#rv-ear)" stroke="#4a2c0f" strokeWidth="1.2" />
          <path className={styles.earR} d="M74 30 q14 8 8 30 q-10 4 -16 -8 z" fill="url(#rv-ear)" stroke="#4a2c0f" strokeWidth="1.2" />
          <ellipse cx="50" cy="42" rx="26" ry="22" fill="url(#rv-fur)" stroke="#6b4419" strokeWidth="1.5" />
          <ellipse cx="50" cy="52" rx="15" ry="10" fill="#fbe7c4" />
          <g className={styles.eyes}>
            <ellipse cx="41" cy="38" rx="3.2" ry="3.6" fill="#1b1b1b" />
            <ellipse cx="59" cy="38" rx="3.2" ry="3.6" fill="#1b1b1b" />
            <circle cx="42" cy="37" r="1" fill="#fff" />
            <circle cx="60" cy="37" r="1" fill="#fff" />
          </g>
          <ellipse cx="50" cy="49" rx="4.5" ry="3.2" fill="#2b1a0c" />
          <path d="M45 55 q5 4 10 0" stroke="#6b4419" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          {/* the brow, for the searching look */}
          <path className={styles.brow} d="M35 30 q6 -3 12 0 M53 30 q6 -3 12 0" stroke="#6b4419" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
        {/* collar */}
        <path d="M30 60 q20 10 40 0" stroke="#c8262b" strokeWidth="4" fill="none" />
        <circle cx="50" cy="65" r="2.6" fill="#f0c200" stroke="#8a6d00" strokeWidth="0.8" />
      </svg>
    </div>
  );
}
