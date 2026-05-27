import { useNetworkStatus } from "../use-network-status";
import { Banner } from "../ui";
import { t } from "../i18n";

/**
 * Surfaces network + outbox state to the employee (audit fix #5 phase 3).
 *
 * Three states:
 *   - offline:           "You're offline. Closes will sync when you reconnect."
 *   - online + pending:  "{N} pending — syncing…"
 *   - online + empty:    renders nothing (no banner pollution)
 *
 * Drop into any screen. EmployeeScreen renders it at the top of the
 * scroll view; could go in OwnerScreen later too.
 */
export function OfflineBanner() {
  const { isOnline, pending } = useNetworkStatus();

  if (!isOnline) {
    return <Banner tone="warn" title={t("net.offlineTitle")} body={t("net.offlineBody")} />;
  }
  if (pending > 0) {
    const title = pending === 1
      ? t("net.syncingOne")
      : t("net.syncingMany").replace("{count}", String(pending));
    return <Banner tone="warn" title={title} body={t("net.syncingBody")} />;
  }
  return null;
}
