import { useState, type ComponentType } from "react";
import { useWindowStore } from "../store/windowStore";
import { errorDialog } from "../store/dialogStore";
import { useSoundStore } from "../store/soundStore";
import { apps, type AppId } from "./registry";
import { useMediaQuery, COARSE } from "../hooks/useMediaQuery";
import {
  AccessibilityIcon,
  AddHardwareIcon,
  AddRemoveProgramsIcon,
  AudioDevicesIcon,
  DateTimeIcon,
  DisplayPropertiesIcon,
  FolderOptionsIcon,
  FontsIcon,
  GameControllerIcon,
  InternetOptionsIcon,
  KeyboardIcon,
  MouseIcon,
  NetworkConnectionsIcon,
  PhoneModemIcon,
  PowerOptionsIcon,
  PrintersIcon,
  RegionalIcon,
  ScannersCamerasIcon,
  ScheduledTasksIcon,
  SecurityCenterIcon,
  SystemPropertiesIcon,
  TaskbarStartMenuIcon,
  UserAccountsIcon,
} from "../icons";
import styles from "./ControlPanel.module.css";


/* Control Panel, classic view: the grid of applets, alphabetical, the way
 * it looked once you had switched it away from the category page - which
 * everyone did.
 *
 * Six of them open something. The rest are here because a Control Panel
 * with six icons is not the Control Panel; each of those says, honestly,
 * what it would have done and that this computer does not have the part.
 */
type Applet = {
  label: string;
  blurb: string;
  Icon: ComponentType<{ size?: number }>;
  /** What opening it does. Absent: the "not on this computer" message. */
  open?: () => void;
};

export function ControlPanel() {
  const open = useWindowStore((s) => s.open);
  const soundOn = useSoundStore((s) => s.enabled);
  const toggleSound = useSoundStore((s) => s.toggle);
  const coarse = useMediaQuery(COARSE);
  const [selected, setSelected] = useState<string | null>(null);

  const launch = (appId: AppId) => open(appId, { title: apps[appId].title, bounds: apps[appId].defaultSize });
  const missing = (label: string, part: string) => () =>
    void errorDialog(label, `${part}\n\nThis computer does not have one. It is a web page.`);

  const applets: Applet[] = [
    { label: "Accessibility Options", blurb: "Adjust your computer settings for vision, hearing, and mobility.", Icon: AccessibilityIcon, open: missing("Accessibility Options", "StickyKeys, FilterKeys, SoundSentry, High Contrast and the rest of the accessibility features.") },
    { label: "Add Hardware", blurb: "Installs and troubleshoots hardware.", Icon: AddHardwareIcon, open: missing("Add Hardware Wizard", "The wizard looks for hardware that is not yet installed.") },
    { label: "Add or Remove Programs", blurb: "Install or remove programs and Windows components.", Icon: AddRemoveProgramsIcon, open: () => launch("addRemovePrograms") },
    { label: "Date and Time", blurb: "Set the date, time, and time zone for your computer.", Icon: DateTimeIcon, open: () => void errorDialog("Date and Time Properties", `It is ${new Date().toLocaleString()}.\n\nThe clock is your computer's; there is nothing here to set.`) },
    { label: "Display", blurb: "Change the appearance of your desktop, such as the background, screen saver, colors, font sizes, and screen resolution.", Icon: DisplayPropertiesIcon, open: () => launch("displayProperties") },
    { label: "Folder Options", blurb: "Customize the display of files and folders, change file associations, and make network files available offline.", Icon: FolderOptionsIcon, open: () => launch("folderOptions") },
    { label: "Fonts", blurb: "Add, change, and manage fonts on your computer.", Icon: FontsIcon, open: missing("Fonts", "Tahoma, Trebuchet MS, Franklin Gothic Medium, Verdana, Lucida Console. The ones this desktop draws with.") },
    { label: "Game Controllers", blurb: "Add, remove, and configure game controller hardware such as joysticks and gamepads.", Icon: GameControllerIcon, open: missing("Game Controllers", "No game controllers are attached. Solitaire and Minesweeper take a mouse.") },
    { label: "Internet Options", blurb: "Configure your Internet display and connection settings.", Icon: InternetOptionsIcon, open: () => launch("internetExplorer") },
    { label: "Keyboard", blurb: "Customize your keyboard settings, such as the cursor blink rate and the character repeat rate.", Icon: KeyboardIcon, open: missing("Keyboard Properties", "Repeat delay, repeat rate, cursor blink rate.") },
    { label: "Mouse", blurb: "Customize your mouse settings, such as the button configuration, double-click speed, mouse pointers, and motion speed.", Icon: MouseIcon, open: missing("Mouse Properties", "Button configuration, double-click speed, pointer schemes, motion.") },
    { label: "Network Connections", blurb: "Connects to other computers, networks, and the Internet.", Icon: NetworkConnectionsIcon, open: missing("Network Connections", "Local Area Connection: connected, 100 Mbps. It is the one you are reading this over.") },
    { label: "Phone and Modem Options", blurb: "Configure your telephone dialing rules and modem settings.", Icon: PhoneModemIcon, open: missing("Phone and Modem Options", "Dialing rules, modems, advanced. There is no modem, and the sound it made is not coming back.") },
    { label: "Power Options", blurb: "Configure energy-saving settings for your computer.", Icon: PowerOptionsIcon, open: missing("Power Options Properties", "Power schemes, hibernation, UPS. The screen saver's timer is on the Display applet.") },
    { label: "Printers and Faxes", blurb: "Shows installed printers and fax printers and helps you add new ones.", Icon: PrintersIcon, open: missing("Printers and Faxes", "No printers are installed. Save a Copy in the PDF reader is the nearest thing.") },
    { label: "Regional and Language Options", blurb: "Customize settings for the display of languages, numbers, times, and dates.", Icon: RegionalIcon, open: missing("Regional and Language Options", `Standards and formats: ${navigator.language}. Set by your browser.`) },
    { label: "Scanners and Cameras", blurb: "Add, remove, and configure scanners and cameras.", Icon: ScannersCamerasIcon, open: missing("Scanners and Cameras", "No scanners or cameras are installed. Pictures arrive by dropping them on the desktop.") },
    { label: "Scheduled Tasks", blurb: "Schedule computer tasks to run automatically.", Icon: ScheduledTasksIcon, open: missing("Scheduled Tasks", "One task: the screen saver, when you have been away for a while.") },
    { label: "Security Center", blurb: "View your current security status and access security settings.", Icon: SecurityCenterIcon, open: () => void errorDialog("Windows Security Center", "Firewall: ON (your browser's). Automatic Updates: ON (every deploy). Virus Protection: not needed - nothing here can run.") },
    { label: "Sounds and Audio Devices", blurb: "Change the sound scheme for your computer, or configure the settings for your speakers and recording devices.", Icon: AudioDevicesIcon, open: () => { toggleSound(); void errorDialog("Sounds and Audio Devices", `Sounds are now ${soundOn ? "off" : "on"}.\n\nThe speaker in the notification area does the same thing.`); } },
    { label: "System", blurb: "See information about your computer system, and change settings for hardware, performance, and automatic updates.", Icon: SystemPropertiesIcon, open: () => launch("systemProperties") },
    { label: "Taskbar and Start Menu", blurb: "Customize the Start Menu and the taskbar, such as the types of items to be displayed and how they should appear.", Icon: TaskbarStartMenuIcon, open: missing("Taskbar and Start Menu Properties", "Lock the taskbar, auto-hide, show Quick Launch, Start menu style.") },
    { label: "User Accounts", blurb: "Change user account settings and passwords for people who share this computer.", Icon: UserAccountsIcon, open: () => launch("systemProperties") },
  ];

  const current = applets.find((a) => a.label === selected);

  return (
    <div className={styles.app}>
      <div className={styles.side}>
        <div className={styles.sideHead}>Control Panel</div>
        <div className={styles.sideBody}>
          {current ? (
            <>
              <div className={styles.sideTitle}>
                <current.Icon size={32} />
                <b>{current.label}</b>
              </div>
              <p className={styles.sideText}>{current.blurb}</p>
            </>
          ) : (
            <p className={styles.sideText}>Pick a category or an item to see its description.</p>
          )}
          <p className={styles.sideText}>
            <b>See Also</b>
            <br />
            <button type="button" className={styles.link} onClick={() => launch("helpAndSupport")}>
              Help and Support
            </button>
          </p>
        </div>
      </div>

      <div className={styles.grid} onMouseDown={() => setSelected(null)}>
        {applets.map((a) => (
          <button
            key={a.label}
            type="button"
            className={selected === a.label ? `${styles.applet} ${styles.selected}` : styles.applet}
            onMouseDown={(e) => {
              e.stopPropagation();
              setSelected(a.label);
            }}
            onDoubleClick={a.open}
            onClick={coarse ? a.open : undefined}
            title={a.blurb}
          >
            <a.Icon size={32} />
            <span className={styles.appletLabel}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
