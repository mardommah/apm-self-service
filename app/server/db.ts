import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");

    _pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema, mode: "default" });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

/**
 * Runs `fn` while holding a MySQL named lock on its own connection. `fn` writes through getDb() (autocommit),
 * so its rows are committed before the lock is released and the next holder reads them.
 */
export async function withNamedLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.query<mysql.RowDataPacket[]>("SELECT GET_LOCK(?, 5) AS acquired", [name]);
    if (Number(rows[0]?.acquired) !== 1) throw new Error("LOCK_BUSY");
    try {
      return await fn();
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [name]);
    }
  } finally {
    connection.release();
  }
}

/** mysql2 duplicate-key error (any unique index). */
export function isDuplicateKeyError(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "ER_DUP_ENTRY" || err?.cause?.code === "ER_DUP_ENTRY";
}
