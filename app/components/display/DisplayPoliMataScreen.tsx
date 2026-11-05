import { useMemo } from "react";
import { KioskRunningText } from "~/components/kiosk/KioskRunningText";
import { prayerRunningText } from "~/lib/prayer-times";
import { getDisplayPoliMataAction, type DisplayPoliMataData } from "~/server/actions/display-poli-mata";
import { DISPLAY_UTC_OFFSET } from "./displayConfig";
import { DisplayOperasiStrip } from "./DisplayOperasiStrip";
import { DisplayPoliMataPanel } from "./DisplayPoliMataPanel";
import { DisplayPoliOverlay } from "./DisplayPoliOverlay";
import { DisplayPrayerOverlay } from "./DisplayPrayerOverlay";
import { DISPLAY_POLI_MATA_RUNNING_TEXT, displayToday } from "./displayRunningText";
import { DisplaySoundGate } from "./DisplaySoundGate";
import { DisplayTopBar } from "./DisplayTopBar";
import { DisplayVideo } from "./DisplayVideo";
import { useDisplayFill } from "./useDisplayScale";
import { usePoliDisplayFeed } from "./usePoliDisplayFeed";

const fetchFeed = (afterId: number | undefined) => getDisplayPoliMataAction({ data: { afterId } });
const TEST_CALL = { isRecall: false, queueNumber: "PM001", pasien: "TES PANGGILAN", poli: "Poli Mata", kdPoli: "", dokter: "Tes suara display poli mata", calledAt: null };

/** DESIGN-DISPLAY-POLI-MATA.md: video + Poli Mata queue, today's operation schedule underneath. */
export function DisplayPoliMataScreen({ initial }: { initial: DisplayPoliMataData | null }) {
  const { data, offline, prayer, active, activePrayer } = usePoliDisplayFeed(initial, fetchFeed, TEST_CALL);
  const { scale, width, height } = useDisplayFill();

  const today = displayToday();
  const dayKey = `${today.year}-${today.month}-${today.day}`;
  const prayerKey = JSON.stringify(prayer);
  const runningText = useMemo(
    () =>
      prayer.enabled
        ? [prayerRunningText(prayer, today, DISPLAY_UTC_OFFSET), ...DISPLAY_POLI_MATA_RUNNING_TEXT]
        : DISPLAY_POLI_MATA_RUNNING_TEXT,
    [dayKey, prayerKey],
  );

  return (
    <div className="grid h-dvh w-screen place-items-center overflow-hidden bg-bp-ink">
      <div style={{ zoom: scale, width, height }} className="flex shrink-0 flex-col overflow-hidden bg-bp-surface-2">
        <DisplayTopBar eyebrow="DISPLAY ANTREAN / POLI MATA & OPERASI" />
        <main className="flex min-h-0 flex-1">
          <DisplayVideo playlist={data?.playlist ?? ""} ducked={active !== null || activePrayer !== null} />
          <DisplayPoliMataPanel call={data?.lastCall ?? null} called={data?.called ?? []} offline={offline} />
        </main>
        <DisplayOperasiStrip rows={data?.operasi ?? []} />
        <KioskRunningText messages={runningText} size="display" label="Info" />
        <DisplaySoundGate />
        {active && <DisplayPoliOverlay key={active.call.id} active={active} />}
        {activePrayer && <DisplayPrayerOverlay key={activePrayer.prayer.label} active={activePrayer} />}
      </div>
    </div>
  );
}
