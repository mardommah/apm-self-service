import { useMemo } from "react";
import { KioskRunningText } from "~/components/kiosk/KioskRunningText";
import { prayerRunningText } from "~/lib/prayer-times";
import { getDisplayPoliAction, type DisplayPoliData } from "~/server/actions/display-poli";
import { DISPLAY_UTC_OFFSET } from "./displayConfig";
import { DisplayPoliCallPanel } from "./DisplayPoliCallPanel";
import { DisplayPoliStrip } from "./DisplayPoliStrip";
import { DisplayPoliOverlay } from "./DisplayPoliOverlay";
import { DisplayPrayerOverlay } from "./DisplayPrayerOverlay";
import { displayToday } from "./displayRunningText";
import { DisplaySoundGate } from "./DisplaySoundGate";
import { DisplayTopBar } from "./DisplayTopBar";
import { DisplayVideo } from "./DisplayVideo";
import { useDisplayFill } from "./useDisplayScale";
import { usePoliDisplayFeed } from "./usePoliDisplayFeed";

// DESIGN-DISPLAY-POLI.md §5 (prayer times are prepended).
const RUNNING_TEXT = [
  "Selamat datang di Klinik Syamsinar Maros",
  "Terima kasih sudah mengantre dengan tertib",
  "Dengarkan panggilan nomor antrean Anda",
];

const fetchFeed = (afterId: number | undefined) => getDisplayPoliAction({ data: { afterId } });
const TEST_CALL = { isRecall: false, queueNumber: "PU001", pasien: "TES PANGGILAN", poli: "Poli Umum", kdPoli: "", dokter: "Tes suara display poli", calledAt: null };

export function DisplayPoliScreen({ initial }: { initial: DisplayPoliData | null }) {
  const { data, offline, prayer, callPoli, active, activePrayer, flashId } = usePoliDisplayFeed(initial, fetchFeed, TEST_CALL);
  const { scale, width, height } = useDisplayFill();

  const today = displayToday();
  const dayKey = `${today.year}-${today.month}-${today.day}`;
  const prayerKey = JSON.stringify(prayer);
  const runningText = useMemo(
    () => (prayer.enabled ? [prayerRunningText(prayer, today, DISPLAY_UTC_OFFSET), ...RUNNING_TEXT] : RUNNING_TEXT),
    [dayKey, prayerKey],
  );

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
