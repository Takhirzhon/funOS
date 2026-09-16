import { useState, type ReactNode } from "react";
import { useWindowStore } from "../store/windowStore";
import { apps, type AppId } from "./registry";
import { HelpIcon } from "../icons";
import styles from "./HelpAndSupport.module.css";

/* Help and Support Center: one page. The blue banner, a column of topics,
 * and the thing nobody found in the real one - a straight list of what this
 * desktop does and which keys do it. */

type Topic = { id: string; title: string; body: ReactNode };

/* A link that opens a program, in the topic text. */
function L({ id, children }: { id: AppId; children: ReactNode }) {
  const open = useWindowStore((s) => s.open);
  return (
    <button
      type="button"
      className={styles.link}
      onClick={() => open(id, { title: apps[id].title, bounds: apps[id].defaultSize })}
    >
      {children}
    </button>
  );
}

export function HelpAndSupport() {

  const topics: Topic[] = [
    {
      id: "start",
      title: "What this is",
      body: (
        <>
          <p>
            A Windows XP desktop that runs in your browser, and the portfolio of the person who made it. Nothing is
            installed on your computer; close the tab and it is gone, except what you saved - the file system
            lives in your browser&rsquo;s storage and is there next time.
          </p>
          <p>
            The CV is on the desktop. The photographs are in My Pictures, the clips in My Videos, and Internet
            Explorer opens on the home page, with Work, Projects, Photos, a Guestbook and a Blog.
          </p>
        </>
      ),
    },
    {
      id: "keys",
      title: "Keyboard shortcuts",
      body: (
        <table className={styles.keys}>
          <tbody>
            <tr><td>Ctrl+Esc</td><td>Open the Start menu (the Windows key too, where your computer lets it through)</td></tr>
            <tr><td>Ctrl+Alt+Left / Right</td><td>Switch between windows (Alt+Tab where it arrives)</td></tr>
            <tr><td>Ctrl+Shift+Esc</td><td>Task Manager</td></tr>
            <tr><td>Pause</td><td>System Properties</td></tr>
            <tr><td>Delete / Shift+Delete</td><td>Recycle a file / delete it for good</td></tr>
            <tr><td>Ctrl+X, Ctrl+C, Ctrl+V</td><td>Cut, copy, paste files, on the desktop and in Explorer</td></tr>
            <tr><td>Ctrl+click, Shift+click</td><td>Add to a selection, select a range; drag a rectangle for a marquee</td></tr>
            <tr><td>Enter, Escape</td><td>OK and Cancel in every dialog</td></tr>
          </tbody>
        </table>
      ),
    },
    {
      id: "files",
      title: "Files and folders",
      body: (
        <>
          <p>
            Drop a file from your own computer onto the desktop or into any Explorer window and it is copied in.
            Text opens in Notepad, pictures in Windows Picture Viewer, clips in Windows Media Player, PDFs in
            the reader. Right-click anything for Cut, Copy, Rename, Delete and Properties, where the Hidden
            attribute is.
          </p>
          <p>
            The files that came with the machine - the CV, the photographs, the blog posts - are the
            owner&rsquo;s and cannot be deleted, renamed or moved: Windows says &ldquo;Access is denied&rdquo;,
            and so does this.
          </p>
        </>
      ),
    },
    {
      id: "apps",
      title: "Programs",
      body: (
        <ul className={styles.list}>
          <li>
            <L id="internetExplorer">Internet Explorer</L> - the home page, and &ldquo;The page cannot be
            displayed&rdquo; for everything else.
          </li>
          <li>
            <L id="notepad">Notepad</L>, <L id="paint">Paint</L>, <L id="calculator">Calculator</L>,{" "}
            <L id="commandPrompt">Command Prompt</L>
          </li>
          <li>
            <L id="solitaire">Solitaire</L> and <L id="minesweeper">Minesweeper</L>
          </li>
          <li>
            <L id="mediaPlayer">Windows Media Player</L> - the folder is the playlist.
          </li>
          <li>
            <L id="controlPanel">Control Panel</L>, <L id="taskManager">Task Manager</L>,{" "}
            <L id="displayProperties">Display Properties</L> - themes, the desktop background, screen savers
            including 3D Maze.
          </li>
          <li>
            Run... in the Start menu takes <code>notepad</code>, <code>calc</code>, <code>mspaint</code>,{" "}
            <code>sol</code>, <code>winmine</code>, <code>cmd</code>, <code>taskmgr</code>, <code>control</code>, a
            path, or an address.
          </li>
        </ul>
      ),
    },
    {
      id: "trouble",
      title: "Troubleshooting",
      body: (
        <>
          <p>
            <b>A window opened off the edge.</b> Right-click the taskbar and choose Cascade Windows. Windows
            remember where they were last left, per program.
          </p>
          <p>
            <b>The desktop is a mess.</b> Right-click it, Arrange Icons By, Auto Arrange.
          </p>
          <p>
            <b>Something is stuck.</b> Ctrl+Shift+Esc, or right-click the taskbar, Task Manager, End Task. Do not
            end csrss.exe.
          </p>
          <p>
            <b>Start over.</b> Start, Turn Off Computer, Restart replays the boot. Your files stay; clearing the
            site&rsquo;s data in your browser is the only thing that removes them.
          </p>
        </>
      ),
    },
  ];
  const [topic, setTopic] = useState(topics[0].id);
  const current = topics.find((t) => t.id === topic) ?? topics[0];

  return (
    <div className={styles.app}>
      <div className={styles.banner}>
        <HelpIcon size={28} />
        <span className={styles.bannerTitle}>Help and Support Center</span>
        <span className={styles.bannerSub}>funOS Professional</span>
      </div>
      <div className={styles.body}>
        <div className={styles.topics}>
          <div className={styles.topicsHead}>Pick a Help topic</div>
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === topic ? `${styles.topic} ${styles.topicCurrent}` : styles.topic}
              onClick={() => setTopic(t.id)}
            >
              {t.title}
            </button>
          ))}
        </div>
        <div className={styles.content}>
          <h2 className={styles.h2}>{current.title}</h2>
          {current.body}
        </div>
      </div>
    </div>
  );
}
