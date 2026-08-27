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
