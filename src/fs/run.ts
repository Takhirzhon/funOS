import { useWindowStore } from "../store/windowStore";
import { useFsStore } from "../store/fsStore";
import { errorDialog, runDialog } from "../store/dialogStore";
import { apps, type AppId } from "../apps/registry";
import { launchFile } from "./open";
import { basename, normalize } from "./path";

/* Run... - the box that took a program's name.
 *
 * The names are the ones people typed: the executables and the control panel
 * applets, exactly as they were spelled on the real thing, and nothing else.
 * `notepad`, `calc`, `mspaint` and `sol` are in more fingers than any menu.
 */
const PROGRAMS: Record<string, AppId> = {
  notepad: "notepad",
  calc: "calculator",
  mspaint: "paint",
  pbrush: "paint",
  cmd: "commandPrompt",
  command: "commandPrompt",
  sol: "solitaire",
  winmine: "minesweeper",
  explorer: "explorer",
  wmplayer: "mediaPlayer",
  mplayer2: "mediaPlayer",
  iexplore: "internetExplorer",
  "desk.cpl": "displayProperties",
  control: "displayProperties",
  "sysdm.cpl": "systemProperties",
  winver: "about",
};

const MRU_KEY = "run.mru";
const MRU_MAX = 12;

export function runHistory(): string[] {
  try {
    const raw = localStorage.getItem(MRU_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function remember(command: string): void {
  try {
    const next = [command, ...runHistory().filter((c) => c !== command)].slice(0, MRU_MAX);
    localStorage.setItem(MRU_KEY, JSON.stringify(next));
  } catch {
    /* Storage disabled: the box just forgets. */
  }
}

const launch = (appId: AppId, props?: Record<string, unknown>, title = apps[appId].title) =>
  useWindowStore.getState().open(appId, { title, bounds: apps[appId].defaultSize, props });

/** Runs one line as the Run box would. Returns whether anything opened. */
export function runCommand(input: string): boolean {
  const command = input.trim();
  if (!command) return false;
  remember(command);

  /* The program name is the first word, minus a .exe nobody had to type. */
  const [head, ...rest] = command.split(/\s+/);
  const name = head.toLowerCase().replace(/\.exe$/, "");
  const argument = rest.join(" ");

  if (name in PROGRAMS) {
    const appId = PROGRAMS[name];
    /* `notepad readme.txt`, the way it always worked. */
    if (argument && (appId === "notepad" || appId === "explorer")) {
      const entry = useFsStore.getState().get(normalize(argument));
      if (entry?.kind === "file") {
        launchFile(entry);
        return true;
      }
      if (entry?.kind === "dir" && appId === "explorer") {
        launch("explorer", { path: entry.path }, basename(entry.path));
        return true;
      }
    }
    launch(appId);
    return true;
  }

  /* A path: a folder opens in Explorer, a file in whatever opens it. */
  if (/^[a-z]:/i.test(command) || command.startsWith("\\") || command.startsWith("/")) {
    const entry = useFsStore.getState().get(normalize(command));
    if (entry?.kind === "dir") {
      launch("explorer", { path: entry.path }, basename(entry.path));
      return true;
    }
    if (entry?.kind === "file") {
      launchFile(entry);
      return true;
    }
  }

  /* An address: Run always handed those to the browser. */
  if (/^(https?:\/\/|www\.|about:)/i.test(command) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(command)) {
    launch("internetExplorer", { url: command });
    return true;
  }

  void errorDialog(
    command,
    `Windows cannot find '${command}'. Make sure you typed the name correctly, and then try again. To search for a file, click the Start button, and then click Search.`
  );
  return false;
}

/** The whole gesture: the box, then the command. */
export async function run(): Promise<void> {
  const command = await runDialog();
  if (command !== null) runCommand(command);
}
