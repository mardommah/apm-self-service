import { useEffect, useRef, useState } from "react";
import { KioskRunningText } from "~/components/kiosk/KioskRunningText";
import { getDisplayAction, type DisplayData } from "~/server/actions/display";
import { DisplayCallOverlay } from "./DisplayCallOverlay";
import { DisplayCallPanel } from "./DisplayCallPanel";
import { DISPLAY_POLL_MAX_MS, DISPLAY_POLL_MS } from "./displayConfig";
import { DisplayLoketList } from "./DisplayLoketList";
import { DISPLAY_RUNNING_TEXT } from "./displayRunningText";
import { DisplayTopBar } from "./DisplayTopBar";
import { DisplayVideo } from "./DisplayVideo";
import { useCallAnnouncer } from "./useCallAnnouncer";

export function DisplayScreen({ initial }: { initial: DisplayData }) {
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(false);
  const cursor = useRef(initial.cursor);
  const { active, flashId, enqueue } = useCallAnnouncer();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let delay = DISPLAY_POLL_MS;
    let stopped = false;
    async function poll() {
      try {
        const next = await getDisplayAction({ data: { afterId: cursor.current } });
        cursor.current = next.cursor;
        setData(next);
        setOffline(false);
        enqueue(next.calls);
        delay = DISPLAY_POLL_MS;
      } catch {
        setOffline(true);
        delay = Math.min(delay * 2, DISPLAY_POLL_MAX_MS);
      }
      if (!stopped) timer = setTimeout(poll, delay);
    }
    timer = setTimeout(poll, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enqueue]);

  return (
    <div className="flex h-dvh cursor-none flex-col overflow-hidden bg-bp-surface-2">
      <DisplayTopBar />
      <main className="flex min-h-0 flex-1">
        <DisplayVideo playlist={data.playlist} ducked={active !== null} />
        <aside className="flex w-[640px] shrink-0 flex-col border-l border-bp-ink bg-bp-surface">
          <DisplayCallPanel call={data.lastCall} offline={offline} />
          <DisplayLoketList lokets={data.lokets} activeId={data.lastCall?.id} flash={flashId === data.lastCall?.id} />
        </aside>
      </main>
      <KioskRunningText messages={DISPLAY_RUNNING_TEXT} size="display" />
      {active && <DisplayCallOverlay key={active.call.id} active={active} />}
    </div>
  );
}
