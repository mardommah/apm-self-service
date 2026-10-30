import { useEffect } from "react";
import { isAudioUnlocked, unlockAudio } from "~/lib/announce";

/**
 * Invisible: the first click/key anywhere on the TV page enables bell + voice (Chrome blocks audio until then).
 * PC TV runs Chrome with --autoplay-policy=no-user-gesture-required, so it never needs the click.
 */
export function DisplaySoundGate() {
  useEffect(() => {
    if (isAudioUnlocked()) return;
    const unlock = () => {
      void unlockAudio();
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

  return null;
}
