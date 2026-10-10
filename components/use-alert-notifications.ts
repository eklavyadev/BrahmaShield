"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Snapshot } from "@/lib/domain";
import {
  alertVersion,
  newAlertNotifications,
  notificationContent,
} from "@/lib/alert-notifications";
const PREF = "bs-alert-notifications";
const SEEN = "bs-alert-notifications-seen";
async function showNotice(title: string, body: string, tag: string, open: () => void) {
  const options = { body, tag, icon: "/icon.svg", data: { url: "/alerts" } };
  if ("serviceWorker" in navigator) {
    const registered = await navigator.serviceWorker.getRegistration();
    if (registered?.active) {
      await registered.showNotification(title, options);
      return;
    }
  }
  const notice = new Notification(title, options);
  notice.onclick = () => {
    notice.close();
    window.focus();
    open();
  };
}
export function useAlertNotifications(data: Snapshot | null, region: string) {
  const router = useRouter();
  const open = useCallback(() => router.push("/alerts"), [router]);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const memory = useRef<string[]>([]);
  const enabledRef = useRef(false);
  const readSeen = useCallback(() => {
    try {
      const values: unknown = JSON.parse(localStorage.getItem(SEEN) || "[]");
      return Array.isArray(values)
        ? values.filter((v): v is string => typeof v === "string").slice(-500)
        : memory.current;
    } catch {
      return memory.current;
    }
  }, []);
  const remember = useCallback((values: string[]) => {
    memory.current = [...new Set(values)].slice(-500);
    try {
      localStorage.setItem(SEEN, JSON.stringify(memory.current));
    } catch {
      /* Private browsing: session-only deduplication. */
    }
  }, []);
  useEffect(() => {
    const sync = () => {
      const supported = window.isSecureContext && "Notification" in window;
      setPermission(supported ? Notification.permission : "unsupported");
      let optedIn = false;
      try {
        optedIn = localStorage.getItem(PREF) === "true";
      } catch {
        optedIn = enabledRef.current;
      }
      enabledRef.current = optedIn;
      setEnabled(optedIn);
      setReady(true);
    };
    queueMicrotask(sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  useEffect(() => {
    if (!ready || !data) return;
    const deliver = async () => {
      const seen = readSeen();
      const fresh =
        enabledRef.current && permission === "granted"
          ? newAlertNotifications(
              data.alerts.filter(
                (alert) => alert.sourceType !== "forecast" || data.weatherFeed?.status === "live",
              ),
              seen,
              region,
              Date.now(),
            )
          : [];
      if (fresh.length) {
        const content = notificationContent(fresh);
        await showNotice(content.title, content.body, "bs-weather-alerts", open);
      }
      remember([...seen, ...data.alerts.map(alertVersion)]);
    };
    // Serialize delivery across tabs so one update does not produce duplicate notifications.
    const task =
      "locks" in navigator ? navigator.locks.request("bs-alert-notifications", deliver) : deliver();
    void task.catch(() =>
      setMessage("Notification could not be displayed. Check browser and system settings."),
    );
  }, [data, region, ready, permission, enabled, readSeen, remember, open]);
  async function toggle() {
    if (enabled && permission === "granted") {
      enabledRef.current = false;
      setEnabled(false);
      try {
        localStorage.setItem(PREF, "false");
      } catch {
        /* Session preference still works. */
      }
      setMessage("Notifications paused on this browser.");
      return;
    }
    if (permission === "unsupported") return;
    setBusy(true);
    setMessage("");
    try {
      // This call must stay directly inside the user's button action.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage(
          result === "denied"
            ? "Notifications are blocked. Allow them in this site's browser settings."
            : "Permission was not granted. You can try again.",
        );
        return;
      }
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js");
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Notification service is not ready")), 5000),
          ),
        ]);
      }
      remember([...readSeen(), ...(data?.alerts.map(alertVersion) || [])]);
      enabledRef.current = true;
      setEnabled(true);
      try {
        localStorage.setItem(PREF, "true");
      } catch {
        /* Session preference still works. */
      }
      setMessage("Enabled for new advisories in the selected district while the app is open.");
    } catch {
      setMessage("Unable to enable notifications. Check your browser settings.");
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    try {
      await showNotice(
        "BrahmaShield · test",
        "This is a test notification, not a weather warning.",
        "bs-notification-test",
        open,
      );
      setMessage("Test requested. Check your system notification centre.");
    } catch {
      setMessage("Test could not be displayed. Check browser and system notification settings.");
    } finally {
      setBusy(false);
    }
  }
  return {
    enabled: enabled && permission === "granted",
    permission,
    ready,
    busy,
    message,
    toggle,
    test,
  };
}
