"use server";

// Test requests from the settings page for the TV (prayer announcement, patient call). Kept in memory
// (one server process): a restart simply drops it. Nothing is written to queue_calls or mLITE.
export type DisplayTest = { id: number; kind: "prayer" } | { id: number; kind: "call"; loket: number };

let lastTest: DisplayTest | null = null;

export function requestDisplayTest(test: { kind: "prayer" } | { kind: "call"; loket: number }) {
  lastTest = { ...test, id: Date.now() };
  return lastTest;
}

export function getDisplayTest() {
  return lastTest;
}

// /display-poli has its own slot, so a poli test never plays on the loket TV (and the other way round).
let lastPoliTest: { id: number } | null = null;

export function requestPoliDisplayTest() {
  lastPoliTest = { id: Date.now() };
  return lastPoliTest;
}

export function getPoliDisplayTest() {
  return lastPoliTest;
}
