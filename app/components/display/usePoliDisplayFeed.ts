import { useEffect, useRef, useState } from "react";
import { loadResponsiveVoice } from "~/lib/announce";
import { poliCallText } from "~/lib/poli-call";
import { DEFAULT_PRAYER_SETTINGS, type PrayerSettings } from "~/lib/prayer-times";
import type { PoliCall } from "~/server/functions/display-poli";
import { DISPLAY_POLL_MAX_MS, DISPLAY_POLL_MS } from "./displayConfig";
import { useCallAnnouncer } from "./useCallAnnouncer";
import { usePrayerAlarm } from "./usePrayerAlarm";

type PoliFeed = {
  calls: PoliCall[];
  lastCall: PoliCall | null;
  lastCallAgeMs: number | null;
  cursor: number;
  test: { id: number } | null;
  responsiveVoiceKey: string;
  prayer: PrayerSettings;
};

const textOf = (call: PoliCall) => poliCallText(call.queueNumber, call.pasien, call.poli);

// A page (re)loaded this soon after a call announces it once more: an accidental reload must not cut a call off.
// Longer than one announcement (bell + voice 2×, ±8–15 s).
const REPLAY_RECENT_MS = 20_000;
const isRecent = (data: PoliFeed) =>
  data.lastCall !== null && data.lastCall.id > 0 && data.lastCallAgeMs !== null && data.lastCallAgeMs < REPLAY_RECENT_MS;

/**
 * Poli TV polling shared by /display-poli and /display-poli-mata: announces new calls (FIFO), prayer times and the
 * admin test call (`testCall`, negative id). `callPoli`: kd_poli of each announced call id.
 */
export function usePoliDisplayFeed<D extends PoliFeed>(
  initial: D | null,
  fetchFeed: (afterId: number | undefined) => Promise<D>,
  testCall: Omit<PoliCall, "id">,
) {
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(!initial);
  const cursor = useRef(initial?.cursor);
  const replayed = useRef(false);
  // A test sent before this page opened is not replayed.
  const seenTest = useRef(initial?.test?.id);
  const announcer = useCallAnnouncer<PoliCall>(textOf);
  const { enqueue } = announcer;
  const callPoli = useRef(new Map<number, string>());
  const prayer = data?.prayer ?? DEFAULT_PRAYER_SETTINGS;
  usePrayerAlarm(prayer, announcer.enqueuePrayer);
  useEffect(() => loadResponsiveVoice(data?.responsiveVoiceKey ?? ""), [data?.responsiveVoiceKey]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let delay = DISPLAY_POLL_MS;
    let stopped = false;
    async function poll() {
      try {
        // First poll after a failed SSR load only seeds the cursor: older calls are not replayed, except a very recent one.
        const next = await fetchFeed(cursor.current);
        for (const c of next.calls) callPoli.current.set(c.id, c.kdPoli);
        const seeding = cursor.current === undefined;
        if (!seeding) enqueue(next.calls);
        else if (isRecent(next) && !replayed.current) {
          replayed.current = true;
          enqueue([next.lastCall!]);
        }
        const test = next.test;
        if (test && test.id !== seenTest.current) {
          seenTest.current = test.id;
          // Negative id: never flashes a real poli tile.
          if (!seeding) enqueue([{ ...testCall, id: -test.id }]);
        }
        cursor.current = next.cursor;
        setData(next);
        setOffline(false);
        delay = DISPLAY_POLL_MS;
      } catch {
        setOffline(true);
        delay = Math.min(delay * 2, DISPLAY_POLL_MAX_MS);
      }
      if (!stopped) timer = setTimeout(poll, delay);
    }
    if (initial && isRecent(initial) && !replayed.current) {
      replayed.current = true;
      callPoli.current.set(initial.lastCall!.id, initial.lastCall!.kdPoli);
      enqueue([initial.lastCall!]);
    }
    timer = setTimeout(poll, initial ? delay : 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enqueue]);

  return { data, offline, prayer, callPoli, ...announcer };
}
