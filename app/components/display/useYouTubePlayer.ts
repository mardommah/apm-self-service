import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "./youtubeApi";
import { useVideoInfo } from "./useVideoInfo";

const READY_TIMEOUT_MS = 15_000;
const RETRY_MS = 60_000;
const PLAYER_VARS = {
  listType: "playlist", autoplay: 1, mute: 1, controls: 0, loop: 1,
  rel: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3,
};

export function useYouTubePlayer(playlist: string, volume: number) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const volumeRef = useRef(volume);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!playlist || !host) return setFailed(true);
    let cancelled = false;
    let isReady = false;
    const fail = () => !cancelled && setFailed(true);
    setFailed(false);
    const timeout = setTimeout(() => !isReady && fail(), READY_TIMEOUT_MS);
    const el = host.appendChild(document.createElement("div"));
    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(el, {
        width: "100%",
        height: "100%",
        playerVars: { ...PLAYER_VARS, list: playlist },
        events: {
          onReady: (event: any) => {
            event.target.unMute();
            event.target.setVolume(volumeRef.current);
            event.target.playVideo();
            isReady = true;
            setReady(true);
          },
          onError: fail,
        },
      });
    }, fail);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      playerRef.current?.destroy?.();
      playerRef.current = null;
      host.innerHTML = "";
      setReady(false);
    };
  }, [playlist, attempt]);

  useEffect(() => {
    if (!failed || !playlist) return;
    const id = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
    return () => clearTimeout(id);
  }, [failed, playlist]);

  // Ramp volume over ~400ms when ducking for a call and back.
  useEffect(() => {
    const from = volumeRef.current;
    volumeRef.current = volume;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      playerRef.current?.setVolume?.(Math.round(from + ((volume - from) * step) / 8));
      if (step >= 8) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [volume]);

  const info = useVideoInfo(playerRef, ready);

  return { hostRef, ready, failed: failed || !playlist, info };
}
