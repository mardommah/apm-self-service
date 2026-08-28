import mysql, { type RowDataPacket } from "mysql2/promise";

export type SimrsBooking = {
  bookingCode: string;
  cardNumber: string;
  referralNumber: string;
  medicalRecordNumber: string;
  doctorName: string;
  queueNumber: string;
};

type SimrsBookingRow = RowDataPacket & {
  nobooking: string;
  nomorkartu: string;
  nomorreferensi: string;
  norm: string;
  nama_dokter: string;
  nomorantrean: string;
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

export async function findTodaySimrsBooking(bookingCode: string, cardNumber: string) {
  let rows: SimrsBookingRow[];
  try {
    [rows] = await getSimrsPool().execute<SimrsBookingRow[]>(
      `SELECT
        r.nobooking,
        r.nomorkartu,
        r.nomorreferensi,
        r.norm,
        COALESCE(d.nm_dokter, r.kodedokter, '') AS nama_dokter,
        r.nomorantrean
      FROM referensi_mobilejkn_bpjs r
      LEFT JOIN dokter d ON d.kd_dokter = r.kodedokter
      WHERE r.tanggalperiksa = CURRENT_DATE()
        AND r.nomorkartu = ?
        AND r.nobooking = ?
      LIMIT 1`,
      [cardNumber, bookingCode],
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
    doctorName: booking.nama_dokter,
    queueNumber: booking.nomorantrean,
  } satisfies SimrsBooking;
}
