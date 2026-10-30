import { useEffect, useState, type RefObject } from "react";
import { fetchVideoTitle } from "./youtubeApi";

export interface VideoInfo {
  title: string;
  author: string;
  current: number;
  duration: number;
  index: number;
  total: number;
  nextTitle: string;
}

const EMPTY: VideoInfo = { title: "", author: "", current: 0, duration: 0, index: 0, total: 0, nextTitle: "" };

/** Reads title, progress and playlist position from the YouTube player every second. */
export function useVideoInfo(playerRef: RefObject<any>, ready: boolean) {
  const [info, setInfo] = useState<VideoInfo>(EMPTY);

  useEffect(() => {
    if (!ready) return setInfo(EMPTY);
    let cancelled = false;
    const id = setInterval(async () => {
      const player = playerRef.current;
      if (!player?.getPlaylist) return;
      const ids: string[] = player.getPlaylist() ?? [];
      const index = player.getPlaylistIndex() ?? 0;
      const nextId = ids.length ? ids[(index + 1) % ids.length] : "";
      const nextTitle = nextId ? await fetchVideoTitle(nextId) : "";
      const video = player.getVideoData?.() ?? {};
      if (cancelled) return;
      setInfo({
        title: video.title ?? "",
        author: video.author ?? "",
        current: player.getCurrentTime?.() ?? 0,
        duration: player.getDuration?.() ?? 0,
        index: index + 1,
        total: ids.length,
        nextTitle,
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, playerRef]);

  return info;
}
