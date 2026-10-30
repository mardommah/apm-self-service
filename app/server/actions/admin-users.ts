import { createServerFn } from "@tanstack/react-start";
import { createAdmin, listAdmins } from "../functions/auth";
import { requireAdminToken } from "./admin-auth";

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
const MIN_PASSWORD_LENGTH = 8;

export const listAdminsAction = createServerFn({ method: "GET" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    return listAdmins();
  });

export const createAdminAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string; password: string; role: string }) => {
    const username = data.username.trim();
    if (!USERNAME_PATTERN.test(username)) throw new Error("USERNAME_INVALID");
    if (data.password.length < MIN_PASSWORD_LENGTH) throw new Error("PASSWORD_TOO_SHORT");
    if (data.role !== "admin" && data.role !== "security") throw new Error("ROLE_INVALID");
    return { token: data.token, username, password: data.password, role: data.role as "admin" | "security" };
  })
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    try {
      await createAdmin(data.username, data.password, data.role);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Duplicate")) throw new Error("USERNAME_TAKEN");
      throw error;
    }
    return { ok: true };
  });
