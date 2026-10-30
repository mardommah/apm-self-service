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

/** Chrome pauses a video that unmutes without a user gesture, so sound is enabled only once audio is allowed. */
export function applySound(player: any, volume: number) {
  if (!isAudioUnlocked()) return player.mute();
  player.unMute();
  player.setVolume(volume);
}
