"use server";

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { appSettings } from "../schema";

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
