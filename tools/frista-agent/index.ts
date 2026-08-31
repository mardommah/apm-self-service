import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type JobPayload = { visitId: string; cardHash: string; exp: number };

const port = Number(process.env.FRISTA_AGENT_PORT ?? 3001);
const secret = process.env.FRISTA_AGENT_SHARED_SECRET ?? "";
const allowedOrigin = process.env.FRISTA_ALLOWED_ORIGIN ?? "http://localhost:3886";
const upstream = process.env.FRISTA_BOT_URL ?? "http://127.0.0.1:3000/?app=frista";
const username = process.env.FRISTA_USERNAME ?? "";
const password = process.env.FRISTA_PASSWORD ?? "";
let activeVisitId: string | null = null;
let fristaReady = false;
let lastLoginError: string | null = null;

if (secret.length < 32 || !username || !password) {
  throw new Error("Set FRISTA_AGENT_SHARED_SECRET (>=32 chars), FRISTA_USERNAME, and FRISTA_PASSWORD");
}

function cors(origin: string | null) {
  return origin === allowedOrigin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
}

function verifyToken(token: string, cardNumber: string): JobPayload {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) throw new Error("INVALID_JOB_TOKEN");
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) {
    throw new Error("INVALID_JOB_TOKEN");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as JobPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("JOB_TOKEN_EXPIRED");
  if (payload.cardHash !== createHash("sha256").update(cardNumber).digest("hex")) {
    throw new Error("PATIENT_MISMATCH");
  }
  return payload;
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const origin = request.headers.get("origin");
    const headers = cors(origin);
    if (origin && origin !== allowedOrigin) return Response.json({ code: "ORIGIN_DENIED" }, { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, busy: Boolean(activeVisitId), fristaReady, lastLoginError }, { headers });
    }
    if (url.pathname !== "/jobs/frista" || request.method !== "POST") {
      return Response.json({ code: "NOT_FOUND" }, { status: 404, headers });
    }

    try {
      const body = await request.json() as { token?: string; cardNumber?: string };
      if (!body.token || !body.cardNumber || !/^\d{13}$/.test(body.cardNumber)) {
        throw new Error("INVALID_REQUEST");
      }
      const payload = verifyToken(body.token, body.cardNumber);
      if (activeVisitId) {
        return Response.json({ code: "AGENT_BUSY" }, { status: 409, headers });
      }
      activeVisitId = payload.visitId;
      fristaReady = false;
      try {
        const response = await fetch(upstream, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            username,
            password,
            card_number: body.cardNumber,
            exit: "true",
            wait: "1000",
          }),
          signal: AbortSignal.timeout(Number(process.env.FRISTA_JOB_TIMEOUT_MS ?? 180_000)),
        });
        if (!response.ok) {
          lastLoginError = `FRISTA_BOT_FAILED_${response.status}`;
          return Response.json({ code: "FRISTA_BOT_FAILED" }, { status: 502, headers });
        }
        fristaReady = true;
        lastLoginError = null;
        return Response.json({ ok: true, visitId: payload.visitId }, { headers });
      } finally {
        activeVisitId = null;
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "AGENT_ERROR";
      return Response.json({ code }, { status: 400, headers });
    }
  },
});

console.log(`Frista secure agent listening on http://127.0.0.1:${port}`);
