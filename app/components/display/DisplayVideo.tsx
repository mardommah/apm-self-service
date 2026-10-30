import { Volume1, VolumeX } from "lucide-react";
import { DISPLAY_DUCKED_VOLUME, DISPLAY_VIDEO_VOLUME } from "./displayConfig";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { YouTubeMark } from "./YouTubeMark";

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function DisplayVideo({ playlist, ducked }: { playlist: string; ducked: boolean }) {
  const volume = ducked ? DISPLAY_DUCKED_VOLUME : DISPLAY_VIDEO_VOLUME;
  const { hostRef, ready, failed, info } = useYouTubePlayer(playlist, volume);
  const playing = ready && !failed;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-5 pb-7 pl-10 pr-8 pt-8">
      <div className="flex items-center justify-between font-caption text-[13px] text-bp-muted">
        <div className="flex items-center gap-2.5">
          <span>FIG. 01 — VIDEO YOUTUBE</span>
          {info.author && (
            <span className="flex items-center gap-2 border border-bp-ink px-2.5 py-1 text-xs text-bp-ink">
              <YouTubeMark /> {info.author}
            </span>
          )}
        </div>
        {info.total > 1 && <span>PLAYLIST {info.index} / {info.total}</span>}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden border border-bp-ink bg-bp-navy">
        <div ref={hostRef} className={`absolute inset-0 [&>iframe]:size-full ${failed ? "hidden" : ""}`} />
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <img src="/logo-klinik-s.png" alt="" className="h-24 bg-white object-contain p-3" />
            <p className="font-body text-[22px] text-[#BFDBFE]">Video sedang tidak tersedia</p>
          </div>
        )}
        {playing && (
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute left-7 top-7 flex items-center gap-2.5 bg-bp-navy px-3.5 py-2 font-caption text-[13px] text-white">
              <YouTubeMark size={18} /> YOUTUBE · SEDANG DIPUTAR
            </span>
            <span className="absolute right-7 top-7 flex items-center gap-2.5 bg-white px-3.5 py-2 font-caption text-[13px] text-bp-ink">
              {ducked ? <VolumeX size={16} aria-hidden /> : <Volume1 size={16} aria-hidden />}
              AUDIO {volume}%{ducked && " · DIREDAM"}
            </span>
            <div className="absolute inset-x-0 bottom-0 h-80 bg-[linear-gradient(to_bottom,#0B2A8600,#0B1A30CC)]" />
            <div className="absolute inset-x-7 bottom-7 flex flex-col gap-4">
              <p className="truncate font-display text-[44px] font-medium tracking-[-1px] text-white">{info.title}</p>
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

      {playing && info.total > 1 && info.nextTitle && (
        <div className="flex items-center gap-4">
          <span className="font-caption text-[13px] text-bp-muted">BERIKUTNYA DI PLAYLIST</span>
          <span aria-hidden className="h-px w-6 bg-bp-faint" />
          <span className="truncate font-body text-xl font-medium text-bp-ink">{info.nextTitle}</span>
        </div>
      )}
    </section>
  );
}
