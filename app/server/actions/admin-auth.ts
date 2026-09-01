import { verifyToken } from "../functions/auth";

export function requireAdminToken(token: string, adminOnly = false) {
  const payload = verifyToken(token);
  if (!payload || (adminOnly && payload.role !== "admin")) {
    throw new Error("UNAUTHORIZED");
  }
  return payload;
}
