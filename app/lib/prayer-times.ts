// Daily prayer times computed locally (no external API, keeps working when the TV is offline).
// Kemenag RI method: Subuh -20°, Isya -18°, Ashar Syafi'i (shadow 1×), ihtiyat +2 minutes, rounded up to the minute.
// Sun position: praytimes.org approximations, accurate to well under a minute for these latitudes.

export const PRAYER_NAMES = ["subuh", "dzuhur", "ashar", "maghrib", "isya"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

export const PRAYER_LABELS: Record<PrayerName, string> = {
  subuh: "Subuh",
  dzuhur: "Dzuhur",
  ashar: "Ashar",
  maghrib: "Maghrib",
  isya: "Isya",
};

export type PrayerSettings = {
  enabled: boolean;
  location: string;
  latitude: number;
  longitude: number;
  /** Extra minutes per prayer (±) to match the local mosque / Kemenag table. */
  adjust: Record<PrayerName, number>;
};

/** Maros and nearby towns (kabupaten capitals); picking one fills the coordinates. */
export const PRAYER_LOCATION_PRESETS = [
  { location: "Maros", latitude: -5.0058, longitude: 119.5728 },
  { location: "Makassar", latitude: -5.1477, longitude: 119.4327 },
  { location: "Gowa (Sungguminasa)", latitude: -5.2061, longitude: 119.4552 },
  { location: "Pangkep (Pangkajene)", latitude: -4.8333, longitude: 119.55 },
];

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  enabled: true,
  ...PRAYER_LOCATION_PRESETS[0],
  adjust: { subuh: 0, dzuhur: 0, ashar: 0, maghrib: 0, isya: 0 },
};

/** Parses the stored JSON; anything missing or invalid falls back to the Maros default. */
export function parsePrayerSettings(raw: unknown): PrayerSettings {
  const value = (typeof raw === "string" ? safeJson(raw) : raw) as Partial<PrayerSettings> | null;
  if (!value || typeof value !== "object") return DEFAULT_PRAYER_SETTINGS;
  const number = (n: unknown, min: number, max: number, fallback: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  const adjust = { ...DEFAULT_PRAYER_SETTINGS.adjust };
  for (const name of PRAYER_NAMES) adjust[name] = Math.round(number(value.adjust?.[name], -30, 30, 0));
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_PRAYER_SETTINGS.enabled,
    location: typeof value.location === "string" && value.location.trim() ? value.location.trim().slice(0, 60) : DEFAULT_PRAYER_SETTINGS.location,
    latitude: number(value.latitude, -90, 90, DEFAULT_PRAYER_SETTINGS.latitude),
    longitude: number(value.longitude, -180, 180, DEFAULT_PRAYER_SETTINGS.longitude),
    adjust,
  };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

function sunPosition(jd: number) {
  const d = jd - 2451545.0;
  const g = rad(fix(357.529 + 0.98560028 * d, 360));
  const q = fix(280.459 + 0.98564736 * d, 360);
  const l = rad(fix(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g), 360));
  const e = rad(23.439 - 0.00000036 * d);
  const ra = fix(deg(Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l))) / 15, 24);
  return { declination: Math.asin(Math.sin(e) * Math.sin(l)), equation: q / 15 - ra };
}

function julianDate(year: number, month: number, day: number) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

/**
 * Minutes after local midnight for each prayer on the given calendar day.
 * `utcOffset` in hours (WITA = 8).
 */
export function computePrayerMinutes(
  date: { year: number; month: number; day: number },
  settings: Pick<PrayerSettings, "latitude" | "longitude" | "adjust">,
  utcOffset: number,
): Record<PrayerName, number> {
  const lat = rad(settings.latitude);
  const jd = julianDate(date.year, date.month, date.day) - settings.longitude / (15 * 24);
  // Hours (local solar) for a sun altitude, before (ccw) or after noon; each evaluated at its approximate time.
  const noonAt = (hour: number) => fix(12 - sunPosition(jd + hour / 24).equation, 24);
  const angleTime = (altitude: number, hour: number, ccw: boolean) => {
    const { declination } = sunPosition(jd + hour / 24);
    const cosT =
      (Math.sin(rad(altitude)) - Math.sin(declination) * Math.sin(lat)) / (Math.cos(declination) * Math.cos(lat));
    const t = deg(Math.acos(Math.min(1, Math.max(-1, cosT)))) / 15;
    return noonAt(hour) + (ccw ? -t : t);
  };
  const asrTime = (hour: number) => {
    const { declination } = sunPosition(jd + hour / 24);
    const altitude = deg(Math.atan(1 / (1 + Math.tan(Math.abs(lat - declination)))));
    return angleTime(altitude, hour, false);
  };

  const hours: Record<PrayerName, number> = {
    subuh: angleTime(-20, 5, true),
    dzuhur: noonAt(12),
    ashar: asrTime(13),
    maghrib: angleTime(-0.8333, 18, false),
    isya: angleTime(-18, 18, false),
  };
  const minutes = {} as Record<PrayerName, number>;
  for (const name of PRAYER_NAMES) {
    const local = hours[name] + utcOffset - settings.longitude / 15;
    // Ihtiyat +2 minutes, rounded up like the Kemenag tables, then the admin correction.
    minutes[name] = Math.ceil(local * 60 + 2) + settings.adjust[name];
  }
  return minutes;
}

export function formatMinutes(minutes: number) {
  const m = fix(Math.round(minutes), 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** One running-text line, e.g. "Jadwal sholat Maros: Subuh 04:21 · Dzuhur 11:47 · …". */
export function prayerRunningText(settings: PrayerSettings, date: { year: number; month: number; day: number }, utcOffset: number) {
  const minutes = computePrayerMinutes(date, settings, utcOffset);
  const times = PRAYER_NAMES.map((name) => `${PRAYER_LABELS[name]} ${formatMinutes(minutes[name])}`).join(" · ");
  return `Jadwal sholat ${settings.location} hari ini: ${times}`;
}
