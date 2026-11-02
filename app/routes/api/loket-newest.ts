import { createHash, timingSafeEqual } from "node:crypto";
import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getLoketCallerState } from "~/server/functions/loket-caller";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Feed for tools/loket-notifier (Windows toast on new tickets): queue numbers only, no patient data. */
export const APIRoute = createAPIFileRoute("/api/loket-newest")({
  GET: async ({ request }) => {
    const key = process.env.NOTIFIER_KEY ?? "";
    if (key.length < 32) return json({ code: "NOTIFIER_DISABLED" }, { status: 503 });
    const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!timingSafeEqual(digest(supplied), digest(key))) return json({ code: "UNAUTHORIZED" }, { status: 401 });
    const state = await getLoketCallerState();
    return json(state.map(({ serviceCode, label, waiting, newest }) => ({ serviceCode, label, waiting, newest })));
  },
});
