import { useLayoutEffect, useRef, useState } from "react";
import { isBinary, listEntries, useFsStore } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { HOME } from "../fs/seed";
import { basename, display, isDriveRoot, join, normalize } from "../fs/path";
import { entryBytes } from "../fs/icons";
import styles from "./CommandPrompt.module.css";

type Props = { windowId?: string };

const BANNER = [
  "funOS [Version 5.1.2600]",
  "(C) Copyright 1985-2001 Nobody in particular.",
  "",
];

/* Relative or absolute, the way cmd.exe takes them. "C:" and a leading slash
 * are absolute; everything else hangs off the current directory. normalize()
 * does the rest, including "..".
 */
function resolveArg(cwd: string, arg: string): string {
  const trimmed = arg.trim().replace(/^"|"$/g, "");
  if (/^[a-zA-Z]:/.test(trimmed) || trimmed.startsWith("\\") || trimmed.startsWith("/")) {
    return normalize(trimmed);
  }
  return normalize(join(cwd, trimmed));
}

const pad = (s: string, width: number) => s.padStart(width, " ");

const stamp = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function CommandPrompt({ windowId }: Props) {
  const [cwd, setCwd] = useState(() => normalize(HOME));
  const [lines, setLines] = useState<string[]>(BANNER);
  const [input, setInput] = useState("");
  /* Command history, newest last, walked with Up and Down. `cursor` is null
   * when the user is typing something new rather than browsing. */
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Scroll on layout rather than in an effect after paint: the console has to
   * already be at the bottom when the new output first appears, or every
   * command visibly jumps. */
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const prompt = `${display(cwd)}>`;

  const run = (raw: string) => {
    const out: string[] = [`${prompt}${raw}`];
    const trimmed = raw.trim();
    const space = trimmed.indexOf(" ");
    const name = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase();
    const arg = space === -1 ? "" : trimmed.slice(space + 1).trim();
    const fs = useFsStore.getState();

    const emit = (...text: string[]) => out.push(...text);

    switch (name) {
      case "":
        break;

      case "cls":
        setLines([]);
        return;

      case "exit":
        if (windowId) useWindowStore.getState().close(windowId);
        return;

      case "ver":
        emit("", "funOS [Version 5.1.2600]", "");
        break;

      case "help":
        emit(
          "",
          "CD       Displays the name of or changes the current directory.",
          "CLS      Clears the screen.",
          "DEL      Deletes one file.",
          "DIR      Displays a list of files and subdirectories.",
          "ECHO     Displays messages.",
          "EXIT     Quits the command interpreter.",
          "HELP     Provides Help information for funOS commands.",
          "MD       Creates a directory.",
          "TYPE     Displays the contents of a text file.",
          "VER      Displays the funOS version.",
          ""
        );
        break;

      case "echo":
        /* "echo." prints a blank line and "echo" alone reports the state of
         * echo itself. Both are muscle memory for anyone who has written a
         * batch file. */
        emit(arg === "." ? "" : arg === "" ? "ECHO is on." : arg);
        break;

      case "cd":
      case "chdir": {
        if (arg === "") {
          emit(display(cwd));
          break;
        }
        const target = resolveArg(cwd, arg);
        const entry = fs.get(target);
        if (!entry || entry.kind !== "dir") {
          emit("The system cannot find the path specified.");
          break;
        }
        setCwd(target);
        break;
      }

      case "dir": {
        const target = arg ? resolveArg(cwd, arg) : cwd;
        const entry = fs.get(target);
        if (!entry || entry.kind !== "dir") {
          emit("File Not Found");
          break;
        }
        const items = listEntries(fs.entries, target);
        emit("", ` Directory of ${display(target)}`, "");
        if (!isDriveRoot(target)) {
          emit(`${stamp(entry.created)}    <DIR>          .`);
          emit(`${stamp(entry.created)}    <DIR>          ..`);
        }
        let bytes = 0;
        let files = 0;
        let dirs = isDriveRoot(target) ? 0 : 2;
        for (const item of items) {
          if (item.kind === "dir") {
            dirs += 1;
            emit(`${stamp(item.modified)}    <DIR>          ${basename(item.path)}`);
          } else {
            files += 1;
            bytes += entryBytes(item);
            emit(
              `${stamp(item.modified)}    ${pad(entryBytes(item).toLocaleString("en-US"), 14)} ${basename(item.path)}`
            );
          }
        }
        emit(
          `${pad(String(files), 15)} File(s) ${pad(bytes.toLocaleString("en-US"), 14)} bytes`,
          `${pad(String(dirs), 15)} Dir(s)`,
          ""
        );
        break;
      }

      case "type": {
        if (!arg) {
          emit("The syntax of the command is incorrect.");
          break;
        }
        const target = resolveArg(cwd, arg);
        const entry = fs.get(target);
        if (!entry) {
          emit("The system cannot find the file specified.");
          break;
        }
        if (entry.kind === "dir") {
          emit("Access is denied.");
          break;
        }
        if (isBinary(entry)) {
          /* Real cmd.exe happily dumps a PNG and fills the console with
           * garbage. Saying so is more useful and less annoying. */
          emit(`${basename(target)} is a binary file.`);
          break;
        }
        emit(...entry.content.split(/\r?\n/));
        break;
      }

      case "md":
      case "mkdir": {
        if (!arg) {
          emit("The syntax of the command is incorrect.");
          break;
        }
        const target = resolveArg(cwd, arg);
        if (fs.exists(target)) emit("A subdirectory or file already exists.");
        else if (!fs.mkdir(target)) emit("The system cannot find the path specified.");
        break;
      }

      case "del":
      case "erase": {
        if (!arg) {
          emit("The syntax of the command is incorrect.");
          break;
        }
        const target = resolveArg(cwd, arg);
        const entry = fs.get(target);
        if (!entry) emit("Could Not Find " + display(target));
        else if (entry.kind === "dir") emit("Access is denied.");
        else fs.remove(target);
        break;
      }

      default:
        emit(
          `'${name}' is not recognized as an internal or external command,`,
          "operable program or batch file."
        );
    }

    setLines((prev) => [...prev, ...out]);
  };

  const submit = () => {
    const value = input;
    setInput("");
    setCursor(null);
    if (value.trim()) setHistory((prev) => [...prev, value]);
    run(value);
  };

  const walkHistory = (delta: number) => {
    if (history.length === 0) return;
    const next =
      cursor === null
        ? delta < 0
          ? history.length - 1
          : null
        : Math.min(history.length - 1, Math.max(0, cursor + delta));
    if (next === null) return;
    setCursor(next);
    setInput(history[next]);
  };

  return (
    <div
      ref={bodyRef}
      className={styles.app}
      /* Clicking anywhere in the console puts the caret back in the prompt,
       * because in a terminal there is nowhere else for it to be. */
      onMouseDown={() => inputRef.current?.focus()}
    >
      {lines.map((line, index) => (
        <div key={`${index}-${line}`} className={styles.line}>
          {line === "" ? " " : line}
        </div>
      ))}

      <div className={styles.prompt}>
        <span>{prompt}</span>
        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              walkHistory(-1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              walkHistory(1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setInput("");
              setCursor(null);
            }
          }}
        />
      </div>
    </div>
  );
}
