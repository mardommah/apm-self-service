import { useEffect, useRef, useState } from "react";
import { applySound, nextVideoId, sourceOptions, useVolumeRamp, YT_CUED, YT_ENDED, YT_PAUSED } from "./youtubeSource";
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
  const [muted, setMuted] = useState(true);
  const userMutedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const userPausedRef = useRef(false);

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
            setMuted(applySound(event.target, volumeRef.current, userMutedRef.current));
            isReady = true;
            setReady(true);
          },
          // Any stop the viewer did not ask for via the pause button (blocked unmute, cued, loop not restarting) resumes muted.
          onStateChange: (event: any) => {
            if (userPausedRef.current) return;
            if (event.data === YT_PAUSED || event.data === YT_CUED) {
              event.target.mute();
              setMuted(true);
              event.target.playVideo();
            } else if (event.data === YT_ENDED && options.single) {
              event.target.seekTo(0);
              event.target.playVideo();
            } else if (event.data === YT_ENDED && options.videoIds.length > 1) {
              const current = event.target.getVideoData?.().video_id ?? "";
              event.target.loadVideoById(nextVideoId(options.videoIds, current));
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
    const unmute = () =>
      playerRef.current?.unMute && setMuted(applySound(playerRef.current, volumeRef.current, userMutedRef.current));
    window.addEventListener("pointerdown", unmute);
    return () => window.removeEventListener("pointerdown", unmute);
  }, []);

  useVolumeRamp(playerRef, volumeRef, volume);

  const info = useVideoInfo(playerRef, ready);

  function toggleMute() {
    if (!playerRef.current?.unMute) return;
    userMutedRef.current = !muted;
    setMuted(applySound(playerRef.current, volumeRef.current, userMutedRef.current));
  }

  function togglePause() {
    const player = playerRef.current;
    if (!player?.pauseVideo) return;
    userPausedRef.current = !paused;
    setPaused(!paused);
    if (paused) player.playVideo();
    else player.pauseVideo();
  }

  return { hostRef, ready, failed: failed || !playlist, info, muted, toggleMute, paused, togglePause };
}
