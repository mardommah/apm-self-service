import { useEffect, useRef, useState } from "react";
import { applySound, sourceOptions, YT_CUED, YT_ENDED, YT_PAUSED } from "./youtubeSource";
import { loadYouTubeApi } from "./youtubeApi";
import { useVideoInfo } from "./useVideoInfo";

const READY_TIMEOUT_MS = 15_000;
const RETRY_MS = 60_000;

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
      const options = sourceOptions(playlist);
      playerRef.current = new YT.Player(el, {
        width: "100%",
        height: "100%",
        videoId: options.videoId,
        playerVars: { ...options.playerVars, origin: window.location.origin },
        events: {
          onReady: (event: any) => {
            event.target.mute();
            event.target.playVideo();
            applySound(event.target, volumeRef.current);
            isReady = true;
            setReady(true);
          },
          // Nobody pauses a TV: any stop (blocked unmute, cued, loop not restarting) resumes muted.
          onStateChange: (event: any) => {
            if (event.data === YT_PAUSED || event.data === YT_CUED) {
              event.target.mute();
              event.target.playVideo();
            } else if (event.data === YT_ENDED && options.single) {
              event.target.seekTo(0);
              event.target.playVideo();
            }
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

  // First click anywhere (e.g. the sound gate) lets the video play with sound.
  useEffect(() => {
    const unmute = () => playerRef.current?.unMute && applySound(playerRef.current, volumeRef.current);
    window.addEventListener("pointerdown", unmute);
    return () => window.removeEventListener("pointerdown", unmute);
  }, []);

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
