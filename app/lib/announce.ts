// Waiting-room voice announcements: ResponsiveVoice "Indonesian Female", browser speechSynthesis as fallback.

const RV_VOICE = "Indonesian Female";
// Firmer call voice: slightly lower pitch and normal speed (was 1 / 0.9). Below ~0.85 the female voice starts to sound male.
const CALL_PITCH = 0.9;
const CALL_RATE = 1;
const MAX_SPEAK_MS = 15_000;

/** `key` comes from the server at runtime (getDisplayAction), so a build without the env var still gets it. */
export function loadResponsiveVoice(key: string) {
  if (!key || document.getElementById("responsivevoice")) return;
  const script = document.createElement("script");
  script.id = "responsivevoice";
  script.src = `https://code.responsivevoice.org/responsivevoice.js?key=${encodeURIComponent(key)}`;
  document.head.appendChild(script);
}

export function callText(queueNumber: string, serviceLabel: string, loket: number) {
  // "007" -> "7", "O012" -> "O 12" so the voice reads a number, not digits with leading zeros.
  const spoken = queueNumber.replace(/^(\D*)0*(\d)/, (_, prefix, digit) => `${prefix} ${digit}`).trim();
  return `Antrian Nomor: ${spoken}. Layanan: ${serviceLabel}. Silahkan menuju ke loket ${loket}.`;
}

/** Spoken when a prayer time starts (prayer name inserted). */
export function prayerAnnouncementText(prayerLabel: string) {
  return `Diberitahukan kepada seluruh staff, pasien dan pengunjung Klinik Syamsinar, saat ini telah memasuki waktu sholat ${prayerLabel}. Bagi bapak/ibu yang ingin menunaikan ibadah, fasilitas musholla tersedia di lantai 2. Terima kasih.`;
}

// ResponsiveVoice that never starts (key not valid for this domain, script/network blocked) falls back to the browser voice.
// Without a native Indonesian voice ResponsiveVoice downloads an MP3 per text (~1 s, longer on a busy clinic network).
const RV_START_TIMEOUT_MS = 8_000;

const SERVER_TTS_START_TIMEOUT_MS = 8_000;

/**
 * MP3 from /api/tts (ResponsiveVoice SDK on the server, same "Indonesian Female" on every TV). Resolves false
 * when it never starts (TTS not configured, no internet on the server, autoplay blocked) so the caller falls back.
 */
function serverSpeak(text: string, pitch: number): Promise<boolean> {
  return new Promise((resolve) => {
    const params = new URLSearchParams({ text, pitch: String(pitch), rate: String(CALL_RATE) });
    const audio = new Audio(`/api/tts?${params}`);
    let started = false;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimer);
      clearTimeout(endTimer);
      if (!ok) audio.pause();
      resolve(ok);
    };
    const startTimer = setTimeout(() => started || (console.warn("[announce] server TTS did not start"), finish(false)), SERVER_TTS_START_TIMEOUT_MS);
    const endTimer = setTimeout(() => finish(started), Math.max(MAX_SPEAK_MS, text.length * 120));
    audio.onplaying = () => (started = true);
    audio.onended = () => finish(true);
    audio.onerror = () => {
      console.warn("[announce] server TTS failed, using ResponsiveVoice/browser speech");
      finish(started);
    };
    audio.play().catch(() => finish(false));
  });
}

/** Resolves when speech ends (or after a length-based limit if the engine never reports the end). */
export async function speak(text: string, options: { pitch?: number } = {}): Promise<void> {
  const pitch = options.pitch ?? CALL_PITCH;
  if (await serverSpeak(text, pitch)) return;
  return clientSpeak(text, pitch);
}

/** ResponsiveVoice in the browser, then browser speechSynthesis. */
function clientSpeak(text: string, pitch: number): Promise<void> {
  return new Promise((resolve) => {
    // Long announcements (prayer) need more than the 15s a queue call takes.
    const timer = setTimeout(done, Math.max(MAX_SPEAK_MS, text.length * 120));
    let finished = false;
    function done() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    }
    const rv = (window as any).responsiveVoice;
    // Before the first click ResponsiveVoice's internal audio.play() rejects uncaught (NotAllowedError);
    // browser speech fails quietly instead.
    if (!rv?.voiceSupport?.() || !isAudioUnlocked()) return browserSpeak(text, pitch, done);
    let started = false;
    const watchdog = setTimeout(() => {
      if (started || finished) return;
      console.warn("[announce] ResponsiveVoice did not start, using browser speech");
      rv.cancel();
      browserSpeak(text, pitch, done);
    }, RV_START_TIMEOUT_MS);
    rv.cancel();
    rv.speak(text, RV_VOICE, {
      rate: CALL_RATE,
      pitch,
      volume: 1,
      onstart: () => (started = true),
      onend: () => started && (clearTimeout(watchdog), done()),
      onerror: () => {
        console.warn("[announce] ResponsiveVoice error, using browser speech");
        clearTimeout(watchdog);
        if (!started) browserSpeak(text, pitch, done);
        else done();
      },
    });
  });
}

const indonesianVoices = () =>
  "speechSynthesis" in window ? window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("id")) : [];
const localIndonesianVoice = () => indonesianVoices().find((v) => v.localService);

// Chrome drops the onend of an utterance that was garbage collected mid-speech: keep the current one referenced.
let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Browser speechSynthesis, preferring an offline Indonesian voice, then an online one ("Google Bahasa Indonesia"). */
function browserSpeak(text: string, pitch: number, done: () => void) {
  if (!("speechSynthesis" in window)) {
    console.warn("[announce] no speech engine available");
    return done();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;
  utterance.lang = "id-ID";
  const voice = localIndonesianVoice() ?? indonesianVoices()[0];
  if (voice) utterance.voice = voice;
  else console.warn("[announce] no Indonesian browser voice installed; using the default voice");
  utterance.rate = CALL_RATE;
  utterance.pitch = pitch;
  utterance.volume = 1;
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null;
    done();
  };
  utterance.onerror = (event) => {
    console.warn("[announce] browser speech error:", event.error);
    done();
  };
  window.speechSynthesis.cancel();
  // Chrome sometimes silently ignores speak() issued in the same tick as cancel().
  setTimeout(() => window.speechSynthesis.speak(utterance), 50);
}

let audioContext: AudioContext | null = null;

/** Chrome blocks audio and speech until the page gets a click, unless started with --autoplay-policy=no-user-gesture-required. */
export function isAudioUnlocked() {
  audioContext ??= new AudioContext();
  return audioContext.state === "running" || Boolean(navigator.userActivation?.hasBeenActive);
}

/** Call from a click handler: resumes Web Audio and warms up both speech engines. */
export async function unlockAudio() {
  audioContext ??= new AudioContext();
  await audioContext.resume();
  (window as any).responsiveVoice?.clickEvent?.();
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

/** Two-tone bell (~1.2s) synthesized with Web Audio, so no sound asset is needed. */
export function chime(): Promise<void> {
  audioContext ??= new AudioContext();
  const ctx = audioContext;
  void ctx.resume();
  void ctx.resume();
  [659.25, 523.25].forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.45;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.9, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.75);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.8);
  });
  return new Promise((resolve) => setTimeout(resolve, 1200));
}

export const PRAYER_SOUND_URL = "/sounds/prayer-announcement.mp3";

/** Plays an audio file to the end; falls back to the chime if it cannot play (missing file, autoplay blocked). */
export function playSound(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    const timer = setTimeout(done, 20_000);
    function done() {
      clearTimeout(timer);
      resolve();
    }
    audio.onended = done;
    audio.onerror = () => chime().then(done, done);
    audio.play().catch(() => chime().then(done, done));
  });
}
