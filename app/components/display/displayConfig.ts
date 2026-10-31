export const DISPLAY_POLL_MS = 2_000;
export const DISPLAY_POLL_MAX_MS = 10_000;
export const DISPLAY_VIDEO_VOLUME = 40;
export const DISPLAY_DUCKED_VOLUME = 10;
export const DISPLAY_TIMEZONE = "Asia/Makassar";
// WITA has no daylight saving: fixed UTC+8 for the prayer time calculation.
export const DISPLAY_UTC_OFFSET = 8;
// Lokets always listed on the TV, even before their first call: Loket 1 serves the A queue, Loket 2 the B queue (kiosk Antrian Loket 1/2).
export const DISPLAY_DEFAULT_LOKETS = [
  { loket: 1, queue: "A" },
  { loket: 2, queue: "B" },
];
