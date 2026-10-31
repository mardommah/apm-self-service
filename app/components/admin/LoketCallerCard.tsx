import { useState } from "react";
import { Button } from "~/components/ui/button";
import type { LoketCallerState } from "~/server/actions/loket-caller";

type Props = {
  card: LoketCallerState[number];
  busy: boolean;
  onCall: (number?: string) => Promise<void>;
  onRecall: (visitId: string) => Promise<void>;
  onSaveRm: (visitId: string, noRkmMedis: string) => Promise<boolean>;
  onServe: (visitId: string) => Promise<void>;
  onFinish: (visitId: string) => Promise<void>;
};

const inputClass = "h-10 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm";

export function LoketCallerCard({ card, busy, onCall, onRecall, onSaveRm, onServe, onFinish }: Props) {
  const [jump, setJump] = useState("");
  const [rm, setRm] = useState("");
  const current = card.current;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-800">{card.label}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            card.waiting > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
          }`}
        >
          {card.waiting} belum dipanggil
        </span>
      </div>
      {/* Fixed height so cards line up whether or not a number has been called. */}
      <div className="my-3 flex h-[88px] flex-col items-center justify-center text-center">
        {current ? (
          <>
            <div className="font-mono text-5xl font-bold text-gray-900">{current.queueNumber}</div>
            <div className="mt-1 text-xs text-gray-500">
              Terakhir dipanggil · Loket {current.loket}
              {current.finished ? " · Selesai" : current.status === "served" && (current.linked ? " · RM tersimpan" : " · Dilayani")}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-400">Belum ada yang dipanggil</div>
        )}
      </div>
      <Button className="w-full" disabled={busy || card.waiting === 0} onClick={() => onCall()}
        variant={card.waiting === 0 ? "outline" : "default"}>
        {card.waiting === 0 ? "Tidak ada antrean" : `⏭ Panggil berikutnya (${card.waiting})`}
      </Button>
      {current && (
        <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={() => onRecall(current.id)}>
          📣 Panggil ulang {current.queueNumber}
        </Button>
      )}
      {/* Same steps as the visits list: Layani while waiting, then Selesai once served. */}
      {current?.status === "waiting" && (
        <Button variant="success" className="mt-2 w-full" disabled={busy} onClick={() => onServe(current.id)}>
          ✓ Layani {current.queueNumber}
        </Button>
      )}
      {current?.status === "served" && !current.finished && (
        <Button variant="success" className="mt-2 w-full" disabled={busy} onClick={() => onFinish(current.id)}>
          ✓ Selesai dilayani {current.queueNumber}
        </Button>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await onCall(jump);
          setJump("");
        }}
      >
        <input required value={jump} onChange={(e) => setJump(e.target.value)} placeholder={`Panggil nomor lain, mis. ${card.prefix ? `${card.prefix}8` : "008"}`} aria-label={`Panggil nomor tertentu ${card.label}`} className={inputClass} />
        <Button type="submit" variant="outline" disabled={busy}>Panggil</Button>
      </form>
      {current?.linked && current.status === "waiting" && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onSaveRm(current.id, rm)) setRm("");
          }}
        >
          <input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={rm} onChange={(e) => setRm(e.target.value)} placeholder={`No RM untuk ${current.queueNumber}`} aria-label={`No RM ${card.label}`} className={inputClass} />
          <Button type="submit" variant="success" disabled={busy}>Simpan RM</Button>
        </form>
      )}
    </div>
  );
}
