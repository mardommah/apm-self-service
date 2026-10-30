import { useCallback, useEffect, useRef, useState } from "react";
import { callText, chime, loadResponsiveVoice, speak } from "~/lib/announce";
import type { QueueCall } from "~/server/functions/calls";

export interface ActiveCall {
  call: QueueCall;
  round: 1 | 2;
  leaving: boolean;
}

const MIN_CYCLE_MS = 7_600;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** FIFO announcer (DESIGN.md §9.7): bell, overlay, TTS twice, then fade out and flash the loket row. */
export function useCallAnnouncer() {
  const queue = useRef<QueueCall[]>([]);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [flashId, setFlashId] = useState<number>();

  useEffect(() => {
    mounted.current = true;
    loadResponsiveVoice();
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length > 0 && mounted.current) {
      const call = queue.current.shift()!;
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
    }
    busy.current = false;
  }, []);

  const enqueue = useCallback(
    (calls: QueueCall[]) => {
      if (calls.length === 0) return;
      queue.current.push(...calls);
      run();
    },
    [run],
  );

  return { active, flashId, enqueue };
}
