import mysql, { type RowDataPacket } from "mysql2/promise";
import { directInsertQueue } from "./mlite-direct";

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

export function getSimrsPool() {
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

/** Next A/B numbers as createGeneralLoketQueue will issue them (`min*`: app-issued A/B, see there). */
export async function getGeneralLoketPreview(minLoket1 = 0, minLoket2 = 0) {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m-%d') AS date,
      GREATEST(COALESCE(MAX(CASE WHEN type = 'Loket' THEN CAST(noantrian AS UNSIGNED) END), 0), ?) + 1 AS loket1,
      GREATEST(COALESCE(MAX(CASE WHEN type = 'CS' THEN CAST(noantrian AS UNSIGNED) END), 0), ?) + 1 AS loket2
    FROM mlite_antrian_loket WHERE postdate = CURRENT_DATE()`,
    [minLoket1, minLoket2],
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

/** `minNumber`: the next number is above it too (A/B the app issued itself while mLITE was down). */
export async function createGeneralLoketQueue(loket: 1 | 2, minNumber = 0) {
  const connection = await getSimrsPool().getConnection();
  let locked = false;
  try {
    const type = loket === 1 ? "Loket" : "CS";
    const [locks] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('apm_general_loket_queue', 5) AS acquired");
    if (locks[0]?.acquired !== 1) throw new Error("LOKET_QUEUE_BUSY");
    locked = true;
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT GREATEST(COALESCE(MAX(CAST(noantrian AS UNSIGNED)), 0), ?) + 1 AS nextNumber FROM mlite_antrian_loket WHERE type = ? AND postdate = CURRENT_DATE()",
      [minNumber, type],
    );
    const number = Number(rows[0]?.nextNumber);
    if (!Number.isSafeInteger(number) || number < 1) throw new Error("LOKET_QUEUE_FAILED");
    // Straight to SIMRS (same INSERT as mLITE ajax simpanloket/simpancs), no HTTP to the mLITE web app:
    // the number is decided here from today's rows, under the lock.
    const kd = await directInsertQueue(connection, loket === 1 ? "loket" : "cs", number);
    if (!Number.isSafeInteger(kd) || kd < 1) throw new Error("LOKET_QUEUE_FAILED");
    return { number: `${loket === 1 ? "A" : "B"}${number}`, loket, kd };
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

export type SimrsPatientSearch = { name?: string; birthDate?: string; serviceDate?: string };

export type SimrsPatient = {
  noRkmMedis: string;
  name: string;
  birthDate: string | null;
  nik: string;
  address: string;
  visitCount: number;
  lastVisit: string | null;
};

type SimrsPatientRow = RowDataPacket & {
  no_rkm_medis: string;
  nm_pasien: string;
  tgl_lahir: string | null;
  no_ktp: string | null;
  alamat: string | null;
  jml_kunjungan: number | string;
  kunjungan_terakhir: string | null;
};

export const SIMRS_PATIENT_PAGE_SIZE = 50;

/** Read-only lookup in SIMRS `pasien` (+ `reg_periksa` counts). Every filter given must match. `page` starts at 1. */
export async function searchSimrsPatients({ name, birthDate, serviceDate }: SimrsPatientSearch, page = 1) {
  const where: string[] = [];
  const params: string[] = [];
  if (name) {
    // Name prefix (index-friendly, no leading %); LIKE wildcards typed by the user are literal.
    where.push("p.nm_pasien LIKE ?");
    params.push(`${name.replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (birthDate) {
    where.push("p.tgl_lahir = ?");
    params.push(birthDate);
  }
  if (serviceDate) {
    where.push(
      "EXISTS (SELECT 1 FROM reg_periksa r WHERE r.no_rkm_medis = p.no_rkm_medis AND r.tgl_registrasi = ? AND IFNULL(r.stts, '') <> 'Batal')",
    );
    params.push(serviceDate);
  }
  if (where.length === 0) throw new Error("SEARCH_EMPTY");
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("PAGE_INVALID");
  const offset = (page - 1) * SIMRS_PATIENT_PAGE_SIZE;
  let rows: SimrsPatientRow[];
  let total: number;
  try {
    const pool = getSimrsPool();
    const [[countRows], [pageRows]] = await Promise.all([
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM pasien p WHERE ${where.join(" AND ")}`, params),
      // LIMIT/OFFSET are validated integers, inlined (mysql2 execute rejects them as placeholders).
      pool.execute<SimrsPatientRow[]>(
        `SELECT p.no_rkm_medis, p.nm_pasien,
          DATE_FORMAT(p.tgl_lahir, '%Y-%m-%d') AS tgl_lahir, p.no_ktp, p.alamat,
          (SELECT COUNT(*) FROM reg_periksa r
            WHERE r.no_rkm_medis = p.no_rkm_medis AND IFNULL(r.stts, '') <> 'Batal') AS jml_kunjungan,
          (SELECT DATE_FORMAT(MAX(r.tgl_registrasi), '%Y-%m-%d') FROM reg_periksa r
            WHERE r.no_rkm_medis = p.no_rkm_medis AND IFNULL(r.stts, '') <> 'Batal') AS kunjungan_terakhir
        FROM pasien p
        WHERE ${where.join(" AND ")}
        ORDER BY p.nm_pasien, p.no_rkm_medis
        LIMIT ${SIMRS_PATIENT_PAGE_SIZE} OFFSET ${offset}`,
        params,
      ),
    ]);
    rows = pageRows;
    total = Number(countRows[0]?.total ?? 0);
  } catch (error) {
    if (error instanceof Error && error.message === "SIMRS_NOT_CONFIGURED") throw error;
    console.error("[simrs] patient search failed", error);
    throw new Error("SIMRS_UNAVAILABLE");
  }
  const patients = rows.map((row) => ({
    noRkmMedis: row.no_rkm_medis,
    name: row.nm_pasien,
    birthDate: row.tgl_lahir,
    nik: row.no_ktp ?? "",
    address: row.alamat ?? "",
    visitCount: Number(row.jml_kunjungan),
    lastVisit: row.kunjungan_terakhir,
  }) satisfies SimrsPatient);
  return { patients, total, page, pageSize: SIMRS_PATIENT_PAGE_SIZE };
}
