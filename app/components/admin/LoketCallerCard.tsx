import { useState } from "react";
import { Button } from "~/components/ui/button";
import type { LoketCallerState } from "~/server/actions/loket-caller";

type Props = {
  card: LoketCallerState[number];
  busy: boolean;
  onCall: (number?: string) => Promise<void>;
  onRecall: (visitId: string) => Promise<void>;
  onSaveRm: (visitId: string, noRkmMedis: string) => Promise<boolean>;
};

const inputClass = "h-10 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm";

export function LoketCallerCard({ card, busy, onCall, onRecall, onSaveRm }: Props) {
  const [jump, setJump] = useState("");
  const [rm, setRm] = useState("");
  const current = card.current;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{card.label}</h3>
        <span className="text-sm text-gray-500">{card.waiting} menunggu</span>
      </div>
      <div className="my-3 text-center">
        <div className="font-mono text-6xl font-bold text-gray-900">{current?.queueNumber ?? "—"}</div>
        {current && (
          <div className="mt-1 text-xs text-gray-500">
            Loket {current.loket} · {current.status === "served" ? "selesai (RM tersimpan)" : "dipanggil"}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy || !current} onClick={() => current && onRecall(current.id)}>
          📣 Panggil Ulang
        </Button>
        <Button disabled={busy || card.waiting === 0} onClick={() => onCall()}>
          ⏭ Berikutnya
        </Button>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await onCall(jump);
          setJump("");
        }}
      >
        <input required value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Lompat ke nomor (A7)" aria-label={`Lompat nomor ${card.label}`} className={inputClass} />
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
