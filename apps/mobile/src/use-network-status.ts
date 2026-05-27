import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { drainOnce, pendingCount } from "./outbox";

/**
 * Network + outbox status hook (audit fix #5 phase 3).
 *
 * Combines two signals the offline banner needs:
 *   - isOnline: live network reachability via NetInfo. Defaults to true
 *     while the first event hasn't fired so the banner doesn't flash on
 *     mount.
 *   - pending: number of queued ops waiting to drain. Polled every 3s
 *     while online (cheap — just an AsyncStorage read) so the badge
 *     updates without bus-eventing every queue mutation.
 *
 * Also triggers `drainOnce()` whenever connectivity transitions from
 * offline → online so the queue empties immediately on reconnect
 * (the AppState-based drain from phase 2 only catches foreground
 * transitions; this one catches "user stayed in the app while signal
 * came back").
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let prevOnline = true;

    pendingCount().then((n) => !cancelled && setPending(n));

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && !prevOnline) {
        // Reconnected — try to drain immediately.
        drainOnce()
          .then(() => pendingCount())
          .then((n) => !cancelled && setPending(n))
          .catch(() => {});
      }
      prevOnline = online;
    });

    // Poll the outbox so a successful drain elsewhere updates the badge.
    const poll = setInterval(() => {
      pendingCount().then((n) => !cancelled && setPending(n));
    }, 3_000);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(poll);
    };
  }, []);

  return { isOnline, pending };
}
