import { useEffect, type RefObject } from "react";
import { isAudioUnlocked } from "~/lib/announce";

export const YT_ENDED = 0;
export const YT_PAUSED = 2;
export const YT_CUED = 5;

const PLAYER_VARS = { autoplay: 1, mute: 1, controls: 0, loop: 1, rel: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3 };
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Setting value: a playlist ID, or comma-joined video IDs.
 * Video IDs play in order and loop (YouTube loops only when `playlist` lists the IDs, including the first).
 */
export function sourceOptions(source: string) {
  const ids = source.split(",");
  if (ids.every((id) => VIDEO_ID.test(id))) {
    return { videoId: ids[0], single: ids.length === 1, playerVars: { ...PLAYER_VARS, playlist: ids.join(",") } };
  }
  return { videoId: undefined, single: false, playerVars: { ...PLAYER_VARS, listType: "playlist", list: source } };
}

/**
 * Chrome pauses a video that unmutes without a user gesture, so sound is enabled only once audio is allowed
 * (and the viewer has not muted it). Returns whether the player ends up muted.
 */
export function applySound(player: any, volume: number, userMuted = false) {
  if (userMuted || !isAudioUnlocked()) {
    player.mute();
    return true;
  }
  player.unMute();
  player.setVolume(volume);
  return false;
}

/** Ramps the player volume over ~400ms when ducking for a call and back. */
export function useVolumeRamp(playerRef: RefObject<any>, volumeRef: RefObject<number>, volume: number) {
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
}
