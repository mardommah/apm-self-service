import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { synthesize, TTS_MAX_TEXT, ttsEnabled } from "~/server/tts";

const clamp = (value: string | null, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return value !== null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** MP3 of a display announcement (public like the TV pages; text capped so it cannot drain the quota in one call). */
export const APIRoute = createAPIFileRoute("/api/tts")({
  GET: async ({ request }) => {
    if (!ttsEnabled()) return json({ code: "TTS_DISABLED" }, { status: 503 });
    const params = new URL(request.url).searchParams;
    const text = (params.get("text") ?? "").trim();
    if (!text || text.length > TTS_MAX_TEXT) return json({ code: "BAD_TEXT" }, { status: 400 });
    try {
      const audio = await synthesize(text, clamp(params.get("pitch"), 0, 2, 1), clamp(params.get("rate"), 0, 2, 1));
      return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600" } });
    } catch (error) {
      console.error("[tts]", error);
      return json({ code: "TTS_FAILED" }, { status: 502 });
    }
  },
});
