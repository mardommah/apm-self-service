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

export async function createGeneralLoketQueue() {
  const connection = await getSimrsPool().getConnection();
  let locked = false;
  try {
    const [locks] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('apm_general_loket_queue', 5) AS acquired");
    if (locks[0]?.acquired !== 1) throw new Error("LOKET_QUEUE_BUSY");
    locked = true;
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(CAST(noantrian AS UNSIGNED)), 0) + 1 AS nextNumber FROM mlite_antrian_loket WHERE type = 'Loket' AND postdate = CURRENT_DATE()",
    );
    const number = Number(rows[0]?.nextNumber);
    if (!Number.isSafeInteger(number) || number < 1) throw new Error("LOKET_QUEUE_FAILED");
    await connection.execute(
      "INSERT INTO mlite_antrian_loket (type, noantrian, postdate, start_time, end_time) VALUES ('Loket', ?, CURRENT_DATE(), CURRENT_TIME(), '00:00:00')",
      [number],
    );
    return { number: `A${number}` };
  } finally {
    try {
      if (locked) await connection.query("SELECT RELEASE_LOCK('apm_general_loket_queue')");
    } finally {
      connection.release();
    }
  }
}

export async function findTodaySimrsBooking(identifier: string, bookingCode?: string) {
  const field = /^\d{16}$/.test(identifier)
    ? "p.no_ktp"
    : /^\d{13}$/.test(identifier)
      ? "r.nomorkartu"
      : "r.norm";
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
        AND ${field} = ?
        AND (? IS NULL OR r.nobooking = ?)
      LIMIT 1`,
      [identifier, bookingCode ?? null, bookingCode ?? null],
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
