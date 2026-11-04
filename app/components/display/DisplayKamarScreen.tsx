import { useEffect, useMemo, useState } from "react";
import { BedDouble } from "lucide-react";
import { KioskRunningText } from "~/components/kiosk/KioskRunningText";
import { getDisplayKamarAction, type DisplayKamarData } from "~/server/actions/display-kamar";
import { DisplayBedSummary } from "./DisplayBedSummary";
import { DisplayJadwalTable } from "./DisplayJadwalTable";
import { DisplayKamarList } from "./DisplayKamarList";
import { DisplayTopBar } from "./DisplayTopBar";
import { DISPLAY_TIMEZONE } from "./displayConfig";
import { displayToday } from "./displayRunningText";
import { kamarRunningText } from "./kamarRunningText";
import { useDisplayFill } from "./useDisplayScale";

const POLL_MS = 60_000;
const POLL_MAX_MS = 300_000;
const DAY_CHECK_MS = 30_000;

const dayKey = () => Object.values(displayToday()).join("-");
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export function DisplayKamarScreen({ initial }: { initial: DisplayKamarData | null }) {
  const [data, setData] = useState(initial);
  const [failing, setFailing] = useState(false);
  const { scale, width, height } = useDisplayFill();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let delay = POLL_MS;
    let stopped = false;
    let day = dayKey();
    async function poll() {
      clearTimeout(timer);
      day = dayKey();
      try {
        setData(await getDisplayKamarAction());
        setFailing(false);
        delay = POLL_MS;
      } catch {
        setFailing(true);
        delay = Math.min(delay * 2, POLL_MAX_MS);
      }
      if (!stopped) timer = setTimeout(poll, delay);
    }
    timer = setTimeout(poll, initial ? delay : 0);
    // After 00:00 WITA the schedule belongs to the new day: refetch right away.
    const dayCheck = setInterval(() => dayKey() !== day && poll(), DAY_CHECK_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(dayCheck);
    };
  }, []);

  const kamarKey = JSON.stringify(data?.kamar ?? []);
  const runningText = useMemo(() => kamarRunningText(data?.kamar ?? []), [kamarKey]);

  return (
    <div className="grid h-dvh w-screen place-items-center overflow-hidden bg-bp-ink">
      <div style={{ zoom: scale, width, height }} className="flex shrink-0 flex-col overflow-hidden bg-bp-surface-2">
        <DisplayTopBar eyebrow="DISPLAY INFORMASI / RAWAT INAP" />
        <main className="flex min-h-0 flex-1">
          <DisplayJadwalTable jadwal={data?.jadwal ?? null} error={!data} />
          <aside className="flex w-[640px] shrink-0 flex-col border-l border-bp-ink bg-bp-surface">
            {data ? (
              <>
                <DisplayBedSummary kamar={data.kamar} lastOk={failing ? hhmm(data.updatedAt) : null} />
                <DisplayKamarList kamar={data.kamar} />
              </>
            ) : (
              <div className="grid flex-1 place-items-center font-body text-[22px] text-bp-muted">Data SIMRS tidak dapat dimuat</div>
            )}
          </aside>
        </main>
        <KioskRunningText messages={runningText} size="display" label="Tarif" icon={BedDouble} />
      </div>
    </div>
  );
}
