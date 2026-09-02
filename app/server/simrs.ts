import mysql, { type RowDataPacket } from "mysql2/promise";

export type SimrsBooking = {
  bookingCode: string;
  cardNumber: string;
  referralNumber: string;
  medicalRecordNumber: string;
  clinicName: string;
  queueNumber: string;
  patientName: string;
  status: string;
};

type SimrsBookingRow = RowDataPacket & {
  nobooking: string;
  nomorkartu: string;
  nomorreferensi: string;
  norm: string;
  nama_poli: string;
  nomorantrean: string;
  nama_pasien: string;
  status: string;
};

let pool: mysql.Pool | null = null;

function getSimrsPool() {
  if (pool) return pool;
  const host = process.env.SIMRS_DB_HOST;
  const user = process.env.SIMRS_DB_USER;
  const password = process.env.SIMRS_DB_PASS;
  const database = process.env.SIMRS_DB_NAME;
  const port = Number(process.env.SIMRS_DB_PORT ?? 3306);
  if (!host || !user || !password || !database || !Number.isInteger(port)) {
    throw new Error("SIMRS_NOT_CONFIGURED");
  }
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
  });
  return pool;
}

export async function findTodaySimrsBookingByCard(cardNumber: string, bookingCode?: string) {
  let rows: SimrsBookingRow[];
  try {
    [rows] = await getSimrsPool().execute<SimrsBookingRow[]>(
      `SELECT
        r.nobooking,
        r.nomorkartu,
        r.nomorreferensi,
        r.norm,
        COALESCE(NULLIF(pl.nm_poli, ''), r.kodepoli, '') AS nama_poli,
        r.nomorantrean,
        COALESCE(NULLIF(p.nm_pasien, ''), r.norm) AS nama_pasien,
        COALESCE(r.status, '') AS status
      FROM referensi_mobilejkn_bpjs r
      LEFT JOIN pasien p ON p.no_rkm_medis = r.norm
      LEFT JOIN poliklinik pl ON pl.kd_poli = r.kodepoli
      WHERE r.tanggalperiksa = CURRENT_DATE()
        AND r.nomorkartu = ?
        AND (? IS NULL OR r.nobooking = ?)
      LIMIT 1`,
      [cardNumber, bookingCode ?? null, bookingCode ?? null],
    );
  } catch (error) {
    if (error instanceof Error && error.message === "SIMRS_NOT_CONFIGURED") throw error;
    throw new Error("SIMRS_UNAVAILABLE");
  }
  const booking = rows[0];
  if (!booking) throw new Error("SIMRS_BOOKING_NOT_FOUND");
  return {
    bookingCode: booking.nobooking,
    cardNumber: booking.nomorkartu,
    referralNumber: booking.nomorreferensi,
    medicalRecordNumber: booking.norm,
    clinicName: booking.nama_poli,
    queueNumber: booking.nomorantrean,
    patientName: booking.nama_pasien,
    status: booking.status,
  } satisfies SimrsBooking;
}
