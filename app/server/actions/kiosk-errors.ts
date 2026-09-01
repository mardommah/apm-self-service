const messages: Record<string, string> = {
  BPJS_FKTL_NOT_CONFIGURED: "Kredensial API BPJS belum dikonfigurasi.",
  BPJS_FKTL_UNAVAILABLE: "Layanan check-in BPJS tidak dapat dihubungi.",
  BPJS_FKTL_INVALID_RESPONSE: "Respons layanan check-in BPJS tidak valid.",
  BPJS_FKTL_TOKEN_MISSING: "Token layanan check-in BPJS tidak tersedia.",
  BOOKING_CODE_INVALID: "Nomor booking tidak valid.",
  BPJS_CARD_INVALID: "Nomor kartu BPJS harus tepat 13 digit.",
  FRISTA_AGENT_NOT_CONFIGURED: "Agent Frista belum dikonfigurasi pada kiosk.",
  SIMRS_NOT_CONFIGURED: "Koneksi database SIM RS belum dikonfigurasi.",
  SIMRS_UNAVAILABLE: "Database SIM RS tidak dapat dihubungi.",
  SIMRS_BOOKING_NOT_FOUND: "Booking hari ini tidak ditemukan untuk nomor kartu tersebut.",
  SIMRS_BOOKING_CANCELLED: "Booking hari ini berstatus batal.",
  SIMRS_BOOKING_NOT_AVAILABLE: "Booking tidak tersedia untuk check-in.",
  SIMRS_BOOKING_MISMATCH: "Kode booking QR tidak cocok dengan booking pasien hari ini.",
};

export function kioskErrorMessage(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : fallback;
  return messages[code] ?? code;
}
