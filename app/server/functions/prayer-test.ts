"use server";

// Test request from the settings page for the TV: kept in memory (one server process), a restart simply drops it.
let lastTest: { id: number } | null = null;

export function requestPrayerTest() {
  lastTest = { id: Date.now() };
  return lastTest;
}

export function getPrayerTest() {
  return lastTest;
}
