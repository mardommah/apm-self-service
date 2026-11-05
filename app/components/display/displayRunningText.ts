import { DISPLAY_TIMEZONE } from "./displayConfig";

export const DISPLAY_RUNNING_TEXT = [
  "Dengarkan panggilan nomor antrean Anda",
  "Nomor yang terlewat dapat dipanggil ulang di Customer Service",
  "Pasien gawat darurat langsung ke IGD",
  "Jaga kebersihan & ketertiban ruang tunggu",
];

/** Today's calendar date in the display timezone (the TV may run in another timezone). */
export function displayToday(now = new Date()) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIMEZONE })
    .format(now)
    .split("-")
    .map(Number);
  return { year, month, day };
}

// DESIGN-DISPLAY-POLI-MATA.md §5 (prayer times are prepended).
export const DISPLAY_POLI_MATA_RUNNING_TEXT = [
  "Selamat datang di Poli Mata Klinik Syamsinar Maros",
  "Pasien operasi katarak wajib puasa 6 jam & didampingi 1 keluarga",
  "Siapkan kartu BPJS / KTP sebelum dipanggil",
  "Dengarkan panggilan nomor antrean Anda",
];
