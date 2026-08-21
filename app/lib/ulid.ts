// Simple ULID-compatible ID generator (timestamp + random)
// Format: 26 chars, lexicographically sortable
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len; i > 0; i--) {
    str = ENCODING[now % ENCODING_LEN] + str;
    now = Math.floor(now / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) {
    str += ENCODING[bytes[i] % ENCODING_LEN];
  }
  return str;
}

export function ulid(): string {
  const now = Date.now();
  return encodeTime(now, TIME_LEN) + encodeRandom(RANDOM_LEN);
}
