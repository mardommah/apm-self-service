"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "../db";
import { admins } from "../schema";
import type { Admin } from "../schema";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";
const JWT_EXPIRES = "8h";

export interface JwtPayload {
  adminId: number;
  username: string;
  role: string;
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<{ token: string; admin: Omit<Admin, "password"> } | null> {
  const db = getDb();
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);

  if (!admin) return null;

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return null;

  // Update last_login
  await db
    .update(admins)
    .set({ lastLogin: new Date() })
    .where(eq(admins.id, admin.id));

  const token = jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  const { password: _pw, ...safeAdmin } = admin;
  return { token, admin: safeAdmin };
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
