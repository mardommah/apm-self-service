import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isAudioUnlocked, unlockAudio } from "~/lib/announce";

/** Shown until the browser allows audio; one click enables bell + voice for the rest of the session. */
export function DisplaySoundGate() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setLocked(!isAudioUnlocked());
  }, []);

  if (!locked) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await unlockAudio();
        setLocked(false);
      }}
      className="fixed bottom-24 right-8 z-40 flex items-center gap-3 border-2 border-white bg-bp-accent px-6 py-4 font-body text-xl font-medium text-white"
    >
      <Volume2 size={24} aria-hidden />
      Klik untuk mengaktifkan suara panggilan
    </button>
  );
}
