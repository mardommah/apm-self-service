import { useCallback, useEffect, useRef, useState } from "react";
import { callText, chime, loadResponsiveVoice, playSound, PRAYER_SOUND_URL, prayerAnnouncementText, speak } from "~/lib/announce";
import type { QueueCall } from "~/server/functions/calls";

export interface ActiveCall {
  call: QueueCall;
  round: 1 | 2;
  leaving: boolean;
}

/** A prayer time that just started: splash + announcement. */
export interface PrayerCall {
  label: string;
  time: string;
  location: string;
}

export interface ActivePrayer {
  prayer: PrayerCall;
  leaving: boolean;
}

type Announcement = { kind: "call"; call: QueueCall } | { kind: "prayer"; prayer: PrayerCall };

const MIN_CYCLE_MS = 7_600;
const MIN_PRAYER_MS = 12_000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * FIFO announcer (DESIGN.md §9.7): bell, overlay, TTS twice, then fade out and flash the loket row.
 * Prayer announcements share the queue so the voice never talks over a patient call.
 */
export function useCallAnnouncer() {
  const queue = useRef<Announcement[]>([]);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [activePrayer, setActivePrayer] = useState<ActivePrayer | null>(null);
  const [flashId, setFlashId] = useState<number>();

  useEffect(() => {
    mounted.current = true;
    loadResponsiveVoice();
    return () => {
      mounted.current = false;
    };
  }, []);

  const announceCall = useCallback(async (call: QueueCall) => {
    const started = Date.now();
    setFlashId(undefined);
    const bell = chime().catch(() => {});
    await wait(200);
    setActive({ call, round: 1, leaving: false });
    await bell;
    const text = callText(call.queueNumber, call.serviceLabel, call.loket);
    await speak(text);
    await wait(800);
    setActive({ call, round: 2, leaving: false });
    await speak(text);
    await wait(Math.max(0, MIN_CYCLE_MS - (Date.now() - started)));
    setActive({ call, round: 2, leaving: true });
    await wait(400);
    setActive(null);
    setFlashId(call.id);
  }, []);

  const announcePrayer = useCallback(async (prayer: PrayerCall) => {
    const started = Date.now();
    // Announcement jingle (public/sounds), then the voice, like the old mLITE display.
    const sound = playSound(PRAYER_SOUND_URL);
    await wait(200);
    setActivePrayer({ prayer, leaving: false });
    await sound;
    await wait(300);
    await speak(prayerAnnouncementText(prayer.label), { pitch: 1.2 });
    await wait(Math.max(0, MIN_PRAYER_MS - (Date.now() - started)));
    setActivePrayer({ prayer, leaving: true });
    await wait(400);
    setActivePrayer(null);
  }, []);

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length > 0 && mounted.current) {
      const next = queue.current.shift()!;
      if (next.kind === "call") await announceCall(next.call);
      else await announcePrayer(next.prayer);
    }
    busy.current = false;
  }, [announceCall, announcePrayer]);

  const enqueue = useCallback(
    (calls: QueueCall[]) => {
      if (calls.length === 0) return;
      queue.current.push(...calls.map((call) => ({ kind: "call" as const, call })));
      run();
    },
    [run],
  );

  const enqueuePrayer = useCallback(
    (prayer: PrayerCall) => {
      queue.current.push({ kind: "prayer", prayer });
      run();
    },
    [run],
  );

  return { active, activePrayer, flashId, enqueue, enqueuePrayer };
}
