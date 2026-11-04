import type { KamarRow } from "~/server/functions/display-kamar";

const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** DESIGN-DISPLAY-KAMAR.md §5: tarif per kelas, in the same order as the kamar list. */
export function kamarRunningText(kamar: KamarRow[]) {
  return [
    "Tarif Kamar Umum per malam",
    ...kamar.map((k) => `${k.kelas} — ${k.tarifBeda ? "mulai " : ""}Rp ${rupiah.format(k.tarif)}`),
    "Pasien BPJS mengikuti hak kelas perawatan",
  ];
}

export function formatRupiah(value: number) {
  return `Rp ${rupiah.format(value)}`;
}
