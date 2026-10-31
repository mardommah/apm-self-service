"use server";

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { appSettings } from "../schema";
import { parsePrayerSettings, type PrayerSettings } from "~/lib/prayer-times";

const SETTINGS_ID = 1;

export async function getBarcodeEnabled() {
  const [settings] = await getDb()
    .select({ barcodeEnabled: appSettings.barcodeEnabled })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return settings?.barcodeEnabled ?? false;
}

export async function setBarcodeEnabled(barcodeEnabled: boolean) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, barcodeEnabled, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { barcodeEnabled, updatedAt: new Date() },
    });
}

export async function getBookingScannerEnabled() {
  const [settings] = await getDb()
    .select({ bookingScannerEnabled: appSettings.bookingScannerEnabled })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return settings?.bookingScannerEnabled ?? false;
}

export async function setBookingScannerEnabled(bookingScannerEnabled: boolean) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, bookingScannerEnabled, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { bookingScannerEnabled, updatedAt: new Date() },
    });
}

export async function getFristaBypassEnabled() {
  const [settings] = await getDb()
    .select({ fristaBypassEnabled: appSettings.fristaBypassEnabled })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return settings?.fristaBypassEnabled ?? false;
}

export async function setFristaBypassEnabled(fristaBypassEnabled: boolean) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, fristaBypassEnabled, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { fristaBypassEnabled, updatedAt: new Date() },
    });
}

export async function getAutoPrintEnabled() {
  const [settings] = await getDb()
    .select({ autoPrintEnabled: appSettings.autoPrintEnabled })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return settings?.autoPrintEnabled ?? true;
}

export async function setAutoPrintEnabled(autoPrintEnabled: boolean) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, autoPrintEnabled, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { autoPrintEnabled, updatedAt: new Date() },
    });
}

export async function getKioskReturnSeconds() {
  const [settings] = await getDb()
    .select({ kioskReturnSeconds: appSettings.kioskReturnSeconds })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return settings?.kioskReturnSeconds ?? 30;
}

export async function setKioskReturnSeconds(kioskReturnSeconds: number) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, kioskReturnSeconds, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { kioskReturnSeconds, updatedAt: new Date() },
    });
}

export async function getDisplayYoutubePlaylist() {
  const [settings] = await getDb()
    .select({ displayYoutubePlaylist: appSettings.displayYoutubePlaylist })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return settings?.displayYoutubePlaylist ?? "";
}

export async function setDisplayYoutubePlaylist(displayYoutubePlaylist: string) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, displayYoutubePlaylist, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { displayYoutubePlaylist, updatedAt: new Date() },
    });
}

export async function getShowBpjsTestAccounts() {
  const [settings] = await getDb()
    .select({ showBpjsTestAccounts: appSettings.showBpjsTestAccounts })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return settings?.showBpjsTestAccounts ?? true;
}

export async function setShowBpjsTestAccounts(showBpjsTestAccounts: boolean) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, showBpjsTestAccounts, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { showBpjsTestAccounts, updatedAt: new Date() },
    });
}

export async function getPrayerSettings() {
  const [settings] = await getDb()
    .select({ prayerTimes: appSettings.prayerTimes })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  return parsePrayerSettings(settings?.prayerTimes ?? null);
}

export async function setPrayerSettings(prayerTimes: PrayerSettings) {
  await getDb()
    .insert(appSettings)
    .values({ id: SETTINGS_ID, prayerTimes, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { prayerTimes, updatedAt: new Date() },
    });
}
