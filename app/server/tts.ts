import { ResponsiveVoiceAPIClient } from "@responsivevoice/api-client";

// Server-side ResponsiveVoice: one MP3 per text, shared by every TV and both call rounds (saves quota),
// API secret never reaches the browser.
const VOICE = "Indonesian Female";
export const TTS_MAX_TEXT = 400;
const CACHE_SIZE = 200;

let client: ResponsiveVoiceAPIClient | null = null;

export function ttsEnabled() {
  return Boolean(process.env.RESPONSIVEVOICE_API_KEY && process.env.RESPONSIVEVOICE_API_SECRET);
}

function getClient() {
  client ??= new ResponsiveVoiceAPIClient({
    apiKey: process.env.RESPONSIVEVOICE_API_KEY!,
    apiSecret: process.env.RESPONSIVEVOICE_API_SECRET!,
    timeout: 10_000,
    retryAttempts: 1,
  });
  return client;
}

// Pending promises are cached too: 2–3 TVs asking for the same call at once trigger one synthesis.
const cache = new Map<string, Promise<ArrayBuffer>>();

export function synthesize(text: string, pitch: number, rate: number): Promise<ArrayBuffer> {
  const key = `${pitch}|${rate}|${text}`;
  const hit = cache.get(key);
  if (hit) {
    // Re-insert = most recently used.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const audio = getClient()
    .synthesize({ text, voice: VOICE, lang: "id-ID", pitch, rate, format: "mp3" })
    .then((result) => result.blob.arrayBuffer());
  audio.catch(() => cache.delete(key));
  cache.set(key, audio);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return audio;
}
