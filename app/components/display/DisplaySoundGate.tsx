import { useEffect, useState } from "react";
import { isAudioUnlocked, unlockAudio } from "~/lib/announce";

/**
 * The first click/key anywhere on the TV page enables bell + voice (Chrome blocks audio until then).
 * PC TV runs Chrome with --autoplay-policy=no-user-gesture-required, so it never needs the click; any other
 * browser stays silent until the first click (no on-screen notice).
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
  // Invisible full-screen layer (no notice, by request): a click on the YouTube iframe never reaches this window,
  // so without it a click on the video would not enable sound.
  return <button type="button" aria-label="Aktifkan suara" className="fixed inset-0 z-40 cursor-default bg-transparent" />;
}
