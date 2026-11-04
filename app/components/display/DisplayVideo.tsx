import { Pause, Play, Volume1, VolumeX } from "lucide-react";
import { DISPLAY_DUCKED_VOLUME, DISPLAY_VIDEO_VOLUME } from "./displayConfig";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { YouTubeMark } from "./YouTubeMark";

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Player only, edge to edge: no video/playlist titles; controls and progress appear on hover. */
export function DisplayVideo({ playlist, ducked }: { playlist: string; ducked: boolean }) {
  const volume = ducked ? DISPLAY_DUCKED_VOLUME : DISPLAY_VIDEO_VOLUME;
  const { hostRef, ready, failed, info, muted, toggleMute, paused, togglePause } = useYouTubePlayer(playlist, volume);
  const playing = ready && !failed;

  return (
    <section className="flex min-w-0 flex-1 flex-col">

      <div className="group relative min-h-0 flex-1 overflow-hidden bg-bp-navy">
        <div ref={hostRef} className={`absolute inset-0 [&>iframe]:size-full ${failed ? "hidden" : ""}`} />
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <img src="/logo-klinik-s.png" alt="" className="h-24 bg-white object-contain p-3" />
            <p className="font-body text-[22px] text-[#BFDBFE]">Video sedang tidak tersedia</p>
          </div>
        )}
        {/* Audio status, controls and progress stay out of the way: shown only while the mouse is over the video (or the mute button has focus). */}
        {playing && (
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="absolute left-7 top-7 flex items-center gap-2.5 bg-bp-navy px-3.5 py-2 font-caption text-[13px] text-white">
              <YouTubeMark size={18} /> YOUTUBE · {paused ? "DIJEDA" : "SEDANG DIPUTAR"}
            </span>
            <button
              type="button"
              onClick={togglePause}
              aria-pressed={paused}
              aria-label={paused ? "Putar video" : "Jeda video"}
              className="pointer-events-auto absolute bottom-28 right-7 flex items-center gap-2.5 bg-white px-3.5 py-2 font-caption text-[13px] text-bp-ink hover:bg-bp-surface-2"
            >
              {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
              {paused ? "PUTAR" : "JEDA"}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={muted}
              aria-label={muted ? "Nyalakan suara video" : "Matikan suara video"}
              className="pointer-events-auto absolute right-7 top-7 flex items-center gap-2.5 bg-white px-3.5 py-2 font-caption text-[13px] text-bp-ink hover:bg-bp-surface-2"
            >
              {muted || ducked ? <VolumeX size={16} aria-hidden /> : <Volume1 size={16} aria-hidden />}
              {muted ? "AUDIO MATI · KLIK UNTUK SUARA" : `AUDIO ${volume}%${ducked ? " · DIREDAM" : ""}`}
            </button>
            <div className="absolute inset-x-0 bottom-0 h-80 bg-[linear-gradient(to_bottom,#0B2A8600,#0B1A30CC)]" />
            <div className="absolute inset-x-7 bottom-7 flex flex-col gap-4">
              <div className="flex items-center gap-4 font-caption text-[13px]">
                <span className="text-white tabular-nums">{clock(info.current)}</span>
                <div className="h-1 flex-1 bg-[#FFFFFF40]">
                  <div
                    className="h-full bg-bp-sky"
                    style={{ width: `${info.duration ? (info.current / info.duration) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[#BFDBFE] tabular-nums">{clock(info.duration)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

    </section>
  );
}
