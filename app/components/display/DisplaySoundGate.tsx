import { VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { isAudioUnlocked, unlockAudio } from "~/lib/announce";

/**
 * The first click/key anywhere on the TV page enables bell + voice (Chrome blocks audio until then).
 * PC TV runs Chrome with --autoplay-policy=no-user-gesture-required, so it never needs the click; any other
 * browser shows a notice until it gets one, otherwise calls are silent with no hint why.
 */
export function DisplaySoundGate() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (isAudioUnlocked()) return;
    setLocked(true);
    const unlock = () => {
      void unlockAudio().finally(() => setLocked(false));
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  if (!locked) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 right-10 z-40 flex items-center gap-3 border-2 border-bp-ink bg-white px-5 py-3 font-caption text-base text-bp-ink shadow-[0_8px_24px_#0000004D]"
    >
      <VolumeX size={22} aria-hidden />
      SUARA NONAKTIF · KLIK LAYAR SEKALI UNTUK MENGAKTIFKAN
    </div>
  );
}
