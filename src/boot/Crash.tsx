import { Component, type ErrorInfo, type ReactNode } from "react";
import { STOP_ERRORS, useSessionStore } from "../store/sessionStore";
import { BlueScreen } from "./BlueScreen";
import { reloadIfStale } from "./stale";

/* What happens when the desktop itself throws.
 *
 * Without this, an error in render unmounts the whole tree and the page is
 * the body's blue and nothing else - which is what people saw when a deploy
 * replaced the chunks while their tab was open: the next window they opened
 * asked for a file that no longer existed, the lazy import threw, and the
 * desktop vanished without a word.
 *
 * Two answers. A chunk that failed to load is a stale build, and the fix is
 * a reload - once, so a real outage does not loop. Anything else is a bug,
 * and a bug gets the blue screen, with its own STOP code, and any key to
 * reboot: the one crash screen this desktop has that is entirely honest.
 */

type Props = { children: ReactNode };
type State = { crashed: boolean };

export class Crash extends Component<Props, State> {
  state: State = { crashed: false };
  private unsubscribe?: () => void;

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (reloadIfStale(error)) return;
    console.error("funOS crashed:", error, info.componentStack);
    useSessionStore.getState().crash(STOP_ERRORS.unhandled);
  }

  componentDidMount() {
    /* The blue screen reboots into the boot sequence; when it does, the
     * desktop is mounted again from nothing. */
    this.unsubscribe = useSessionStore.subscribe((s) => {
      if (this.state.crashed && s.phase !== "crash") this.setState({ crashed: false });
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  render() {
    return this.state.crashed ? <BlueScreen /> : this.props.children;
  }
}
