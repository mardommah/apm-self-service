import { createServerFn } from "@tanstack/react-start";
import { searchSimrsPatients, type SimrsPatientSearch } from "../simrs";
import { requireAdminToken } from "./admin-auth";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateSearch(data: SimrsPatientSearch & { token: string; page?: number }) {
  const page = data.page ?? 1;
  if (!Number.isInteger(page) || page < 1 || page > 10_000) throw new Error("PAGE_INVALID");
  const name = data.name?.trim().replace(/\s+/g, " ").toUpperCase() || undefined;
  const birthDate = data.birthDate || undefined;
  const serviceDate = data.serviceDate || undefined;
  if (name && (name.length < 3 || name.length > 60)) throw new Error("NAME_INVALID");
  if ((birthDate && !DATE_RE.test(birthDate)) || (serviceDate && !DATE_RE.test(serviceDate))) {
    throw new Error("DATE_INVALID");
  }
  if (!name && !birthDate && !serviceDate) throw new Error("SEARCH_EMPTY");
  return { token: data.token, page, search: { name, birthDate, serviceDate } };
}

/** Patient lookup in SIMRS for any logged-in petugas (read-only). */
export const searchSimrsPatientsAction = createServerFn({ method: "POST" })
  .validator(validateSearch)
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    return searchSimrsPatients(data.search, data.page);
  });
