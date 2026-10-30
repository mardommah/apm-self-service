// Waiting-room voice announcements: ResponsiveVoice "Indonesian Female", browser speechSynthesis as fallback.

const RV_VOICE = "Indonesian Female";
const MAX_SPEAK_MS = 15_000;

export function loadResponsiveVoice() {
  const key = import.meta.env.VITE_RESPONSIVEVOICE_KEY;
  if (!key || document.getElementById("responsivevoice")) return;
  const script = document.createElement("script");
  script.id = "responsivevoice";
  script.src = `https://code.responsivevoice.org/responsivevoice.js?key=${encodeURIComponent(key)}`;
  document.head.appendChild(script);
}

export function callText(queueNumber: string, serviceLabel: string, loket: number) {
  // "007" -> "7", "O012" -> "O 12" so the voice reads a number, not digits with leading zeros.
  const spoken = queueNumber.replace(/^(\D*)0*(\d)/, (_, prefix, digit) => `${prefix} ${digit}`).trim();
  return `Nomor: ${spoken}. Layanan: ${serviceLabel}. Silahkan menuju ke loket ${loket}.`;
}

/** Resolves when speech ends (or after MAX_SPEAK_MS if the engine never reports the end). */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, MAX_SPEAK_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const rv = (window as any).responsiveVoice;
    if (rv?.voiceSupport?.()) {
      rv.cancel();
      rv.speak(text, RV_VOICE, { rate: 0.9, onend: done, onerror: done });
      return;
    }
    if (!("speechSynthesis" in window)) return done();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.9;
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

let audioContext: AudioContext | null = null;

/** Two-tone bell (~1.2s) synthesized with Web Audio, so no sound asset is needed. */
export function chime(): Promise<void> {
  audioContext ??= new AudioContext();
  const ctx = audioContext;
  void ctx.resume();
  [659.25, 523.25].forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.45;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.75);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.8);
  });
  return new Promise((resolve) => setTimeout(resolve, 1200));
}
