import { useEffect, useRef } from "react";
import { computePrayerMinutes, formatMinutes, PRAYER_LABELS, PRAYER_NAMES, type PrayerSettings } from "~/lib/prayer-times";
import { DISPLAY_TIMEZONE, DISPLAY_UTC_OFFSET } from "./displayConfig";
import { displayToday } from "./displayRunningText";
import type { PrayerCall } from "./useCallAnnouncer";

const CHECK_MS = 15_000;
// A tick can land up to CHECK_MS late; a reload long after the prayer started does not replay it.
const WINDOW_MINUTES = 2;

function nowMinutes() {
  const [hour, minute] = new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .split(":")
    .map(Number);
  return hour * 60 + minute;
}

/** Calls `onPrayer` once when each of today's prayer times starts (display timezone). */
export function usePrayerAlarm(settings: PrayerSettings, onPrayer: (prayer: PrayerCall) => void) {
  const fired = useRef(new Set<string>());
  const latest = useRef({ settings, onPrayer });
  latest.current = { settings, onPrayer };

  useEffect(() => {
    function check() {
      const { settings, onPrayer } = latest.current;
      if (!settings.enabled) return;
      const today = displayToday();
      const minutes = computePrayerMinutes(today, settings, DISPLAY_UTC_OFFSET);
      const now = nowMinutes();
      for (const name of PRAYER_NAMES) {
        const key = `${today.year}-${today.month}-${today.day}-${name}`;
        if (fired.current.has(key) || now < minutes[name] || now >= minutes[name] + WINDOW_MINUTES) continue;
        fired.current.add(key);
        onPrayer({ label: PRAYER_LABELS[name], time: formatMinutes(minutes[name]), location: settings.location });
      }
    }
    check();
    const id = setInterval(check, CHECK_MS);
    return () => clearInterval(id);
  }, []);
}

/** For the settings test button: the next prayer of today (Subuh after Isya), announced as if it started now. */
export function nextPrayerCall(settings: PrayerSettings): PrayerCall {
  const minutes = computePrayerMinutes(displayToday(), settings, DISPLAY_UTC_OFFSET);
  const now = nowMinutes();
  const name = PRAYER_NAMES.find((n) => minutes[n] > now) ?? "subuh";
  return { label: PRAYER_LABELS[name], time: formatMinutes(minutes[name]), location: settings.location };
}
