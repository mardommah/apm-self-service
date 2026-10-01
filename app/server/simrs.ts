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

export async function getGeneralLoketPreview() {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m-%d') AS date,
      COALESCE(MAX(CASE WHEN type = 'Loket' THEN CAST(noantrian AS UNSIGNED) END), 0) + 1 AS loket1,
      COALESCE(MAX(CASE WHEN type = 'CS' THEN CAST(noantrian AS UNSIGNED) END), 0) + 1 AS loket2
    FROM mlite_antrian_loket WHERE postdate = CURRENT_DATE()`,
  );
  const row = rows[0];
  const loket1 = Number(row?.loket1);
  const loket2 = Number(row?.loket2);
  if (!Number.isSafeInteger(loket1) || !Number.isSafeInteger(loket2)) throw new Error("LOKET_QUEUE_FAILED");
  return { date: String(row.date), queues: [
    { loket: 1 as const, number: `A${loket1}` },
    { loket: 2 as const, number: `B${loket2}` },
  ] };
}

export async function createGeneralLoketQueue(loket: 1 | 2) {
  const connection = await getSimrsPool().getConnection();
  let locked = false;
  try {
    const type = loket === 1 ? "Loket" : "CS";
    const [locks] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('apm_general_loket_queue', 5) AS acquired");
    if (locks[0]?.acquired !== 1) throw new Error("LOKET_QUEUE_BUSY");
    locked = true;
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(CAST(noantrian AS UNSIGNED)), 0) + 1 AS nextNumber FROM mlite_antrian_loket WHERE type = ? AND postdate = CURRENT_DATE()",
      [type],
    );
    const number = Number(rows[0]?.nextNumber);
    if (!Number.isSafeInteger(number) || number < 1) throw new Error("LOKET_QUEUE_FAILED");
    const url = new URL(process.env.MLITE_GENERAL_PATIENT_URL ?? "");
    if (!/\/anjungan\/pasien\/?$/.test(url.pathname)) throw new Error("MLITE_NOT_CONFIGURED");
    url.pathname = url.pathname.replace(/\/pasien\/?$/, "/ajax");
    url.search = new URLSearchParams({ show: loket === 1 ? "simpanloket" : "simpancs", noantrian: String(number) }).toString();
    const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000) });
    if (!response.ok || response.redirected) throw new Error("LOKET_QUEUE_FAILED");
    const [saved] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM mlite_antrian_loket WHERE type = ? AND noantrian = ? AND postdate = CURRENT_DATE()",
      [type, String(number)],
    );
    if (Number(saved[0]?.total) < 1) throw new Error("LOKET_QUEUE_FAILED");
    return { number: `${loket === 1 ? "A" : "B"}${number}`, loket };
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
