// The petugas' loket is remembered per browser so every admin page calls with the same number.
export const LOKET_COUNT = 9;
const LOKET_STORAGE_KEY = "admin-loket";

export function getSavedLoket() {
  try {
    const saved = Number(localStorage.getItem(LOKET_STORAGE_KEY));
    if (saved >= 1 && saved <= LOKET_COUNT) return saved;
  } catch {}
  return 1;
}

export function saveLoket(value: number) {
  try {
    localStorage.setItem(LOKET_STORAGE_KEY, String(value));
  } catch {}
}
