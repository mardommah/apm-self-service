import { expect, test } from "bun:test";
import { nextVideoId, sourceOptions } from "./youtubeSource";

test("video ID list: first video starts, list advances and wraps", () => {
  const o = sourceOptions("YQ3wl5AhI2o, FzkI7Uo_Hvk");
  expect(o.videoId).toBe("YQ3wl5AhI2o");
  expect(o.videoIds).toEqual(["YQ3wl5AhI2o", "FzkI7Uo_Hvk"]);
  expect("playlist" in o.playerVars).toBe(false);
  expect(nextVideoId(o.videoIds, "YQ3wl5AhI2o")).toBe("FzkI7Uo_Hvk");
  expect(nextVideoId(o.videoIds, "FzkI7Uo_Hvk")).toBe("YQ3wl5AhI2o");
});

test("single video loops via YouTube; playlist ID uses list", () => {
  expect(sourceOptions("YQ3wl5AhI2o").playerVars).toMatchObject({ playlist: "YQ3wl5AhI2o", loop: 1 });
  expect(sourceOptions("PLabcdefghijklmnop").playerVars).toMatchObject({ listType: "playlist", list: "PLabcdefghijklmnop" });
});
