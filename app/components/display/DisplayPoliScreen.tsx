import { useEffect, useMemo, useRef, useState } from "react";
import { KioskRunningText } from "~/components/kiosk/KioskRunningText";
import { loadResponsiveVoice } from "~/lib/announce";
import { poliCallText } from "~/lib/poli-call";
import { DEFAULT_PRAYER_SETTINGS, prayerRunningText } from "~/lib/prayer-times";
import { getDisplayPoliAction, type DisplayPoliData } from "~/server/actions/display-poli";
import type { PoliCall } from "~/server/functions/display-poli";
import { DISPLAY_POLL_MAX_MS, DISPLAY_POLL_MS, DISPLAY_UTC_OFFSET } from "./displayConfig";
import { DisplayPoliCallPanel } from "./DisplayPoliCallPanel";
import { DisplayPoliStrip } from "./DisplayPoliStrip";
import { DisplayPoliOverlay } from "./DisplayPoliOverlay";
import { DisplayPrayerOverlay } from "./DisplayPrayerOverlay";
import { displayToday } from "./displayRunningText";
import { DisplaySoundGate } from "./DisplaySoundGate";
import { DisplayTopBar } from "./DisplayTopBar";
import { DisplayVideo } from "./DisplayVideo";
import { useCallAnnouncer } from "./useCallAnnouncer";
import { useDisplayFill } from "./useDisplayScale";
import { usePrayerAlarm } from "./usePrayerAlarm";

// DESIGN-DISPLAY-POLI.md §5 (prayer times are prepended).
const RUNNING_TEXT = [
  "Selamat datang di Klinik Syamsinar Maros",
  "Terima kasih sudah mengantre dengan tertib",
  "Dengarkan panggilan nomor antrean Anda",
];

const textOf = (call: PoliCall) => poliCallText(call.queueNumber, call.pasien, call.poli);

// A page (re)loaded this soon after a call announces it once more: an accidental reload must not cut a call off.
// Longer than one announcement (bell + voice 2×, ±8–15 s).
const REPLAY_RECENT_MS = 20_000;
const isRecent = (data: DisplayPoliData) =>
  data.lastCall !== null && data.lastCall.id > 0 && data.lastCallAgeMs !== null && data.lastCallAgeMs < REPLAY_RECENT_MS;

export function DisplayPoliScreen({ initial }: { initial: DisplayPoliData | null }) {
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(!initial);
  const cursor = useRef(initial?.cursor);
  const replayed = useRef(false);
  // A test sent before this page opened is not replayed.
  const seenTest = useRef(initial?.test?.id);
  const { active, activePrayer, flashId, enqueue, enqueuePrayer } = useCallAnnouncer<PoliCall>(textOf);
  // Poli of each announced call, so its tile flashes after the overlay.
  const callPoli = useRef(new Map<number, string>());
  const prayer = data?.prayer ?? DEFAULT_PRAYER_SETTINGS;
  usePrayerAlarm(prayer, enqueuePrayer);
  useEffect(() => loadResponsiveVoice(data?.responsiveVoiceKey ?? ""), [data?.responsiveVoiceKey]);
  const { scale, width, height } = useDisplayFill();

  const today = displayToday();
  const dayKey = `${today.year}-${today.month}-${today.day}`;
  const prayerKey = JSON.stringify(prayer);
  const runningText = useMemo(
    () => (prayer.enabled ? [prayerRunningText(prayer, today, DISPLAY_UTC_OFFSET), ...RUNNING_TEXT] : RUNNING_TEXT),
    [dayKey, prayerKey],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let delay = DISPLAY_POLL_MS;
    let stopped = false;
    async function poll() {
      try {
        // First poll after a failed SSR load only seeds the cursor: older calls are not replayed, except a very recent one.
        const next = await getDisplayPoliAction({ data: { afterId: cursor.current } });
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
          if (!seeding) enqueue([{ id: -test.id, isRecall: false, queueNumber: "PU001", pasien: "TES PANGGILAN", poli: "Poli Umum", kdPoli: "", dokter: "Tes suara display poli", calledAt: null }]);
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

  const flashPoli = flashId === undefined ? undefined : callPoli.current.get(flashId);
  // Tile shown as "dipanggil" = the call in the panel; before any recorded call, the poli SIMRS shows as calling.
  const activePoli = data?.lastCall?.kdPoli ?? data?.board.find((row) => row.calling)?.kdPoli;

  return (
    <div className="grid h-dvh w-screen place-items-center overflow-hidden bg-bp-ink">
      <div style={{ zoom: scale, width, height }} className="flex shrink-0 flex-col overflow-hidden bg-bp-surface-2">
        <DisplayTopBar eyebrow="DISPLAY ANTREAN / POLIKLINIK · MODE UJI" />
        <main className="flex min-h-0 flex-1">
          <DisplayVideo playlist={data?.playlist ?? ""} ducked={active !== null || activePrayer !== null} />
          <aside className="flex w-[640px] shrink-0 flex-col border-l border-bp-ink bg-bp-surface">
            <DisplayPoliCallPanel call={data?.lastCall ?? null} offline={offline} />
          </aside>
        </main>
        <DisplayPoliStrip board={data?.board ?? []} activePoli={activePoli} flashPoli={flashPoli} />
        <KioskRunningText messages={runningText} size="display" label="Info" />
        <DisplaySoundGate />
        {active && <DisplayPoliOverlay key={active.call.id} active={active} />}
        {activePrayer && <DisplayPrayerOverlay key={activePrayer.prayer.label} active={activePrayer} />}
      </div>
    </div>
  );
}
